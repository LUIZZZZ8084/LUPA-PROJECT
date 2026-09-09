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

export interface PreferenciaCriada {
  id: string;
  /** URL do Checkout Pro para redirecionar quem está pagando. */
  initPoint: string;
}

export type ResultadoPreferencia =
  | { ok: true; preferencia: PreferenciaCriada }
  /** `detalhe` é o corpo cru da resposta do Mercado Pago, só para o log. */
  | { ok: false; motivo: string; detalhe?: string };

export async function criarPreferencia(
  dados: {
    titulo: string;
    valorCentavos: number;
    /** O id do nosso `pagamentos.id` — é o que o webhook devolve para achar a linha. */
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
         * Sem `auto_return`: ele exige uma `back_url.success` alcançável
         * pela internet, e recusa a preferência inteira com "back_url.
         * success must be defined" quando a URL é `localhost` — em
         * desenvolvimento sem túnel, isso derrubaria toda cobrança antes
         * mesmo de existir. Sem `auto_return`, o Checkout Pro mostra um
         * botão "voltar ao site" em vez de redirecionar sozinho — funciona
         * em qualquer ambiente, só perde o automatismo.
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
    // Tempo esgotado, DNS, TLS: para quem está tentando pagar é tudo a
    // mesma coisa — não deu para começar a cobrança agora.
    return {
      ok: false,
      motivo: "Não foi possível falar com o Mercado Pago agora.",
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

/**
 * Pede o estorno total de um pagamento aprovado.
 *
 * `POST /v1/payments/{id}/refunds` sem corpo devolve o valor inteiro — com
 * `{ amount }` seria parcial, e a decisão do Luiz em 08/09/2026 é devolver
 * tudo.
 *
 * O retorno é explícito, como o resto deste arquivo: aqui é dinheiro, e um
 * erro de rede não pode virar "deu certo" por omissão. Quem chama só
 * revoga a mensalidade quando isto responde `ok` — se o estorno não
 * aconteceu, o dinheiro não voltou, e tirar a vitrine seria o pior dos dois
 * mundos para quem pediu.
 */
export async function estornarPagamento(
  mpPaymentId: string,
  buscar: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  try {
    const resposta = await buscar(
      `${BASE}/v1/payments/${mpPaymentId}/refunds`,
      {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token()}`,
          /*
           * O Mercado Pago exige chave de idempotência no estorno. Sem ela,
           * dois cliques no mesmo botão viram duas devoluções — e a segunda
           * sai do bolso de quem recebeu.
           */
          "X-Idempotency-Key": `estorno-${mpPaymentId}`,
        },
        cache: "no-store",
      },
    );

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      return {
        ok: false,
        motivo: `O Mercado Pago recusou o estorno (${resposta.status}). ${corpo}`,
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
