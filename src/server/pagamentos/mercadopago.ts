import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Chamadas cruas à API do Mercado Pago — Checkout Pro.
 *
 * Mesmo padrão de `src/server/verificacao/cnpj.ts`: `fetch` injetado para
 * o teste não depender de rede, timeout com `AbortSignal.timeout`, e
 * `cache: "no-store"` porque o que se pergunta muda a cada consulta.
 *
 * Ao contrário da BrasilAPI, aqui um erro de rede não pode virar "segue
 * sem verificar" — é dinheiro. Por isso o retorno é sempre um resultado
 * explícito (`ok`/`motivo`), nunca um valor "vazio" que quem chama possa
 * confundir com sucesso.
 */

const BASE = "https://api.mercadopago.com";
const TIMEOUT_MS = 8000;

function token(): string {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "";
}

/** Sem token, a cobrança real não existe — `servico.ts` cai em modo demonstração. */
export const temMercadoPagoConfigurado = Boolean(
  process.env.MERCADO_PAGO_ACCESS_TOKEN,
);

// ── Compra unica: Checkout Pro ────────────────────────────────────────────
//
// O `preapproval` acima autoriza um cartao e cobra todo mes. Aqui e o
// contrario: cobra uma vez e acabou — o caminho da vaga avulsa e dos
// pacotes (#172).
//
// Este bloco ja existiu e foi removido na #170, quando a mensalidade de
// prestador virou recorrente e nada mais criava preferencia. Voltou junto
// com a tela que o usa, que era a condicao registrada la: codigo que
// nenhum caminho alcanca e a mesma armadilha do valor de enum sem
// produtor.

export interface PreferenciaCriada {
  id: string;
  /** URL do Checkout Pro para redirecionar quem esta pagando. */
  initPoint: string;
}

export type ResultadoPreferencia =
  | { ok: true; preferencia: PreferenciaCriada }
  /** `detalhe` e o corpo cru da resposta do Mercado Pago, so para o log. */
  | { ok: false; motivo: string; detalhe?: string };

export async function criarPreferencia(
  dados: {
    titulo: string;
    valorCentavos: number;
    /** O id do nosso `pagamentos.id` — e o que o webhook devolve para achar a linha. */
    referenciaExterna: string;
    urlRetorno: string;
    urlWebhook: string;
  },
  buscar: typeof fetch = fetch,
): Promise<ResultadoPreferencia> {
  try {
    const resposta = await buscar(`${BASE}/checkout/preferences`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: dados.titulo,
            quantity: 1,
            unit_price: dados.valorCentavos / 100,
            currency_id: "BRL",
          },
        ],
        external_reference: dados.referenciaExterna,
        /*
         * Sem `auto_return`: ele exige uma `back_url.success` alcancavel
         * pela internet, e recusa a preferencia inteira com "back_url.
         * success must be defined" quando a URL e `localhost` — em
         * desenvolvimento sem tunel, isso derrubaria toda cobranca antes
         * mesmo de existir. Sem ele, o Checkout Pro mostra um botao
         * "voltar ao site" em vez de redirecionar sozinho: funciona em
         * qualquer ambiente, so perde o automatismo. Descoberto testando
         * com credencial real, nao em teoria.
         */
        back_urls: {
          success: dados.urlRetorno,
          pending: dados.urlRetorno,
          failure: dados.urlRetorno,
        },
        notification_url: dados.urlWebhook,
      }),
      cache: "no-store",
    });

    if (!resposta.ok) {
      const corpoErro = await resposta.text().catch(() => "");
      return {
        ok: false,
        motivo: `O Mercado Pago recusou o pedido (${resposta.status}).`,
        detalhe: corpoErro,
      };
    }

    const corpo = (await resposta.json()) as {
      id?: unknown;
      init_point?: unknown;
    };
    const id = typeof corpo.id === "string" ? corpo.id : null;
    const initPoint =
      typeof corpo.init_point === "string" ? corpo.init_point : null;

    if (!id || !initPoint) {
      return {
        ok: false,
        motivo: "O Mercado Pago respondeu sem os dados esperados.",
      };
    }

    return { ok: true, preferencia: { id, initPoint } };
  } catch {
    // Tempo esgotado, DNS, TLS: para quem esta tentando pagar e tudo a
    // mesma coisa — nao deu para comecar a cobranca agora.
    return {
      ok: false,
      motivo: "Nao foi possivel falar com o Mercado Pago agora.",
    };
  }
}

export interface PagamentoNoMercadoPago {
  id: string;
  /** "approved" | "pending" | "rejected" | "cancelled" | "refunded" | ... */
  status: string;
  referenciaExterna: string | null;
}

/**
 * Relê o pagamento na API do Mercado Pago pelo id.
 *
 * Chamado sempre que se precisa confirmar um pagamento — nunca se confia
 * só no corpo do webhook, que qualquer um pode forjar sem a assinatura
 * (`validarAssinaturaWebhook`) ser o bastante para provar o *conteúdo*,
 * só a origem da notificação.
 */
export async function consultarPagamento(
  mpPaymentId: string,
  buscar: typeof fetch = fetch,
): Promise<PagamentoNoMercadoPago | null> {
  try {
    const resposta = await buscar(`${BASE}/v1/payments/${mpPaymentId}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { authorization: `Bearer ${token()}` },
      cache: "no-store",
    });

    if (!resposta.ok) return null;

    const corpo = (await resposta.json()) as {
      id?: unknown;
      status?: unknown;
      external_reference?: unknown;
    };

    if (
      (typeof corpo.id !== "number" && typeof corpo.id !== "string") ||
      typeof corpo.status !== "string"
    ) {
      return null;
    }

    return {
      id: String(corpo.id),
      status: corpo.status,
      referenciaExterna:
        typeof corpo.external_reference === "string"
          ? corpo.external_reference
          : null,
    };
  } catch {
    return null;
  }
}

// ── Assinaturas recorrentes: `preapproval` (#170) ─────────────────────────
//
// O Checkout Pro acima cobra uma vez. O `preapproval` é a autorização que
// o Mercado Pago guarda para cobrar sozinho todo mês — é o que faz a
// mensalidade renovar sem ninguém lembrar da data.
//
// Duas diferenças que importam em relação à preferência:
//
// 1. **Não se manda `notification_url`.** O endpoint não aceita o campo;
//    os avisos de assinatura saem para a URL configurada no painel do
//    Mercado Pago, e os tópicos `subscription_preapproval` e
//    `subscription_authorized_payment` precisam estar marcados lá.
// 2. **`payer_email` é obrigatório.** Sem ele o Mercado Pago recusa a
//    criação — e é por isso que `criarAssinaturaRecorrente` recebe o
//    e-mail de quem está assinando, coisa que a cobrança avulsa nunca
//    precisou.

export interface AssinaturaNoMercadoPago {
  id: string;
  /** URL onde a pessoa autoriza a cobrança recorrente. */
  initPoint: string | null;
  /** "pending" | "authorized" | "paused" | "cancelled" */
  status: string;
  referenciaExterna: string | null;
}

export type ResultadoAssinatura =
  | { ok: true; assinatura: AssinaturaNoMercadoPago }
  | { ok: false; motivo: string; detalhe?: string };

function leAssinatura(corpo: {
  id?: unknown;
  init_point?: unknown;
  status?: unknown;
  external_reference?: unknown;
}): AssinaturaNoMercadoPago | null {
  const id =
    typeof corpo.id === "string" || typeof corpo.id === "number"
      ? String(corpo.id)
      : null;
  if (!id || typeof corpo.status !== "string") return null;

  return {
    id,
    initPoint: typeof corpo.init_point === "string" ? corpo.init_point : null,
    status: corpo.status,
    referenciaExterna:
      typeof corpo.external_reference === "string"
        ? corpo.external_reference
        : null,
  };
}

/**
 * Cria a assinatura mensal e devolve para onde mandar quem vai autorizar.
 *
 * `status: "pending"` é o modelo sem meio de pagamento definido na
 * criação: o Mercado Pago devolve um `init_point`, a pessoa escolhe o
 * cartão lá, e a assinatura vira `authorized` — o que chega de volta como
 * webhook `subscription_preapproval`.
 *
 * **Com `diasTeste`, o cartão é autorizado na hora e a primeira cobrança
 * sai só depois desse tanto de dias** — é o `free_trial` do
 * `auto_recurring`, e não um campo separado: sem ele, o Mercado Pago cobra
 * assim que a pessoa autoriza. Decisão do Luiz em 09/09/2026 (#170): virar
 * prestador deixou de dar carência sem cartão, e passou a exigir o cartão
 * na hora, com teste grátis antes da primeira cobrança de verdade — quem
 * cancela dentro do prazo nunca chegou a ser cobrado.
 */
export async function criarAssinaturaRecorrente(
  dados: {
    titulo: string;
    valorCentavos: number;
    /** O id do nosso `assinaturas.id` — é o que o webhook devolve para achar a linha. */
    referenciaExterna: string;
    emailPagador: string;
    urlRetorno: string;
    /** Sem isto (ou `0`), a primeira cobrança sai na hora da autorização. */
    diasTeste?: number;
  },
  buscar: typeof fetch = fetch,
): Promise<ResultadoAssinatura> {
  try {
    const resposta = await buscar(`${BASE}/preapproval`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({
        reason: dados.titulo,
        external_reference: dados.referenciaExterna,
        payer_email: dados.emailPagador,
        back_url: dados.urlRetorno,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: dados.valorCentavos / 100,
          currency_id: "BRL",
          ...(dados.diasTeste
            ? {
                free_trial: {
                  frequency: dados.diasTeste,
                  frequency_type: "days",
                },
              }
            : {}),
        },
      }),
      cache: "no-store",
    });

    if (!resposta.ok) {
      const corpoErro = await resposta.text().catch(() => "");
      return {
        ok: false,
        motivo: `O Mercado Pago recusou a assinatura (${resposta.status}).`,
        detalhe: corpoErro,
      };
    }

    const assinatura = leAssinatura(await resposta.json());
    if (!assinatura?.initPoint) {
      return {
        ok: false,
        motivo: "O Mercado Pago respondeu sem os dados esperados.",
      };
    }

    return { ok: true, assinatura };
  } catch {
    return {
      ok: false,
      motivo: "Não foi possível falar com o Mercado Pago agora.",
    };
  }
}

/**
 * Relê a assinatura na API, pelo mesmo motivo de `consultarPagamento`: o
 * webhook prova a origem da notificação, não o conteúdo dela.
 */
export async function consultarAssinatura(
  mpPreapprovalId: string,
  buscar: typeof fetch = fetch,
): Promise<AssinaturaNoMercadoPago | null> {
  try {
    const resposta = await buscar(`${BASE}/preapproval/${mpPreapprovalId}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { authorization: `Bearer ${token()}` },
      cache: "no-store",
    });

    if (!resposta.ok) return null;
    return leAssinatura(await resposta.json());
  } catch {
    return null;
  }
}

/**
 * Interrompe as cobranças futuras.
 *
 * Cancelar não devolve nada — os dias já pagos continuam valendo. O
 * retorno é explícito como o do estorno: se o Mercado Pago não confirmou
 * o cancelamento, marcar a assinatura como cancelada aqui deixaria a
 * pessoa achando que parou de pagar enquanto a cobrança do mês seguinte
 * ainda estivesse programada lá.
 */
export async function cancelarAssinaturaNoMercadoPago(
  mpPreapprovalId: string,
  buscar: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  try {
    const resposta = await buscar(`${BASE}/preapproval/${mpPreapprovalId}`, {
      method: "PUT",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
      cache: "no-store",
    });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      return {
        ok: false,
        motivo: `O Mercado Pago recusou o cancelamento (${resposta.status}). ${corpo}`,
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      motivo: "Não foi possível falar com o Mercado Pago agora.",
    };
  }
}

export interface ParcelaDaAssinatura {
  /** O `preapproval` que gerou esta parcela. */
  preapprovalId: string;
  /** O pagamento em si — `null` enquanto a cobrança ainda não gerou um. */
  mpPaymentId: string | null;
  /** Status do pagamento: "approved", "rejected", "pending"… */
  statusPagamento: string | null;
  valorCentavos: number | null;
}

/**
 * Lê uma parcela da recorrência — o que o tópico
 * `subscription_authorized_payment` aponta.
 *
 * O `data.id` daquele aviso **não é** um id de pagamento: é o id de uma
 * fatura (`authorized_payment`), que por dentro carrega o pagamento de
 * verdade. Tratar um pelo outro faria `GET /v1/payments/{id}` responder
 * 404 e a cobrança recorrente nunca ser registrada aqui.
 */
export async function consultarParcelaDaAssinatura(
  authorizedPaymentId: string,
  buscar: typeof fetch = fetch,
): Promise<ParcelaDaAssinatura | null> {
  try {
    const resposta = await buscar(
      `${BASE}/authorized_payments/${authorizedPaymentId}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { authorization: `Bearer ${token()}` },
        cache: "no-store",
      },
    );

    if (!resposta.ok) return null;

    const corpo = (await resposta.json()) as {
      preapproval_id?: unknown;
      transaction_amount?: unknown;
      payment?: { id?: unknown; status?: unknown } | null;
    };

    if (typeof corpo.preapproval_id !== "string") return null;

    const pagamento = corpo.payment ?? null;
    const mpPaymentId =
      pagamento &&
      (typeof pagamento.id === "string" || typeof pagamento.id === "number")
        ? String(pagamento.id)
        : null;

    return {
      preapprovalId: corpo.preapproval_id,
      mpPaymentId,
      statusPagamento:
        pagamento && typeof pagamento.status === "string"
          ? pagamento.status
          : null,
      valorCentavos:
        typeof corpo.transaction_amount === "number"
          ? Math.round(corpo.transaction_amount * 100)
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Confere a assinatura HMAC do webhook (`x-signature`), no formato que o
 * Mercado Pago documenta para notificações v2: `ts=<epoch>,v1=<hmac>`,
 * assinando o manifesto `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * com `MERCADO_PAGO_WEBHOOK_SECRET`.
 *
 * Sem isto, qualquer um que descobrisse a URL da rota poderia mandar
 * `{ type: "payment", data: { id: "..." } }` e acionar a confirmação de
 * um pagamento que nunca existiu de verdade — o webhook validado é
 * critério de aceite explícito do #46.
 *
 * `timingSafeEqual` em vez de `===`: comparar string por igualdade
 * simples vaza, por tempo de resposta, quantos caracteres já bateram —
 * pouco, mas é o cuidado padrão para comparar segredo.
 */
export function validarAssinaturaWebhook(opcoes: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  segredo: string;
}): boolean {
  if (!opcoes.xSignature || !opcoes.segredo) return false;

  const partes: Record<string, string> = {};
  for (const par of opcoes.xSignature.split(",")) {
    const [chave, valor] = par.split("=");
    if (chave && valor) partes[chave.trim()] = valor.trim();
  }

  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifesto = `id:${opcoes.dataId};${
    opcoes.xRequestId ? `request-id:${opcoes.xRequestId};` : ""
  }ts:${ts};`;
  const esperado = createHmac("sha256", opcoes.segredo)
    .update(manifesto)
    .digest("hex");

  const recebido = Buffer.from(v1);
  const calculado = Buffer.from(esperado);
  if (recebido.length !== calculado.length) return false;

  return timingSafeEqual(recebido, calculado);
}
