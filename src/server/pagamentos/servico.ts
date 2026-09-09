import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Autenticado } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import {
  estenderMensalidade,
  revogarMensalidade,
} from "../prestadores/servico";
import { repositorioPagamentos } from "./index";
import {
  consultarPagamento,
  criarPreferencia,
  estornarPagamento,
  temMercadoPagoConfigurado,
} from "./mercadopago";
import { DESCRICAO_PAGAMENTO, PRECO_CENTAVOS } from "./planos";
import type { Pagamento, TipoPagamento } from "./tipos";

export { temMercadoPagoConfigurado };

function urlBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Aplica o que um pagamento aprovado muda no resto do app.
 *
 * Cada domínio conhece a própria regra — `pagamentos` só aciona; é o
 * mesmo raciocínio de camada do resto do servidor: quem decide como a
 * mensalidade se estende é `src/server/prestadores/servico.ts`, não este
 * arquivo.
 */
async function aplicarEfeito(pagamento: Pagamento): Promise<void> {
  switch (pagamento.tipo) {
    case "prestador_mensalidade":
      await estenderMensalidade(pagamento.usuarioId);
      return;
    default: {
      // Exaustividade: se `TipoPagamento` ganhar um novo valor sem que
      // este switch seja atualizado, o build quebra aqui — não em
      // produção, com uma cobrança aprovada e nenhum efeito aplicado.
      const _exaustivo: never = pagamento.tipo;
      throw erros.interno(`tipo de pagamento sem efeito: ${_exaustivo}`);
    }
  }
}

/**
 * Desfaz o que um pagamento aprovado tinha mudado.
 *
 * Espelha `aplicarEfeito`, e com o mesmo `switch` exaustivo pelo mesmo
 * motivo: um `TipoPagamento` novo que ganhe efeito e não ganhe reversão
 * quebra o build aqui, e não em produção com um estorno sem consequência.
 */
async function desfazerEfeito(pagamento: Pagamento): Promise<void> {
  switch (pagamento.tipo) {
    case "prestador_mensalidade":
      await revogarMensalidade(pagamento.usuarioId);
      return;
    default: {
      const _exaustivo: never = pagamento.tipo;
      throw erros.interno(`tipo de pagamento sem reversão: ${_exaustivo}`);
    }
  }
}

export interface CobrancaCriada {
  pagamento: Pagamento;
  /**
   * `null` em modo demonstração — a cobrança já nasce aprovada, e não há
   * para onde redirecionar. Com o Mercado Pago configurado, é o Checkout
   * Pro.
   */
  checkoutUrl: string | null;
}

/**
 * Cria uma cobrança e, sempre que possível, já devolve para onde mandar
 * quem está pagando.
 *
 * Sem `MERCADO_PAGO_ACCESS_TOKEN` **e** sem Supabase, a cobrança é
 * aprovada na hora — é o que mantém a suíte e2e (sempre em demonstração)
 * e o `npm run dev` sem credencial exercitando o fluxo inteiro, do clique
 * ao efeito. Com banco de verdade e sem token, recusa: o porquê está no
 * comentário do próprio ramo, logo abaixo.
 */
export async function criarCobranca(
  sessao: Autenticado | null,
  tipo: TipoPagamento,
  opcoes: { metadata?: Record<string, unknown>; buscar?: typeof fetch } = {},
): Promise<CobrancaCriada> {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  /*
   * Demonstração é a ausência de infraestrutura inteira, não a de uma
   * credencial.
   *
   * O precedente do Supabase não vale aqui, e a diferença é o modo de
   * falha. Sem Supabase, o app inteiro roda com dados de Sinop e
   * ninguém confunde aquilo com produção. Sem o token do Mercado Pago
   * numa instalação que **tem** Supabase, o que acontece é outra coisa:
   * conta real, prestador real, e a mensalidade aprovada de graça — com
   * um `log.info` dizendo "modo demonstração" e nada na tela. O modo de
   * falha seria "todo mundo passa", que é o pior de todos numa cobrança.
   *
   * Por isso quem decide é `isSupabaseConfigured`, a mesma chave que o
   * resto do app usa para saber se está em produção. Com banco de
   * verdade e sem token, isto é configuração faltando — e recusar é o
   * comportamento certo: ninguém ganha nada de graça, e o log diz o que
   * arrumar.
   */
  if (!temMercadoPagoConfigurado && isSupabaseConfigured) {
    throw erros.indisponivel(
      "MERCADO_PAGO_ACCESS_TOKEN ausente em ambiente com banco real",
    );
  }

  const repo = repositorioPagamentos();
  const pagamento = await repo.criar({
    usuarioId: sessao.usuarioId,
    tipo,
    valorCentavos: PRECO_CENTAVOS[tipo],
    metadata: opcoes.metadata,
  });

  if (!temMercadoPagoConfigurado) {
    const aprovado = await repo.aprovar(pagamento.id, null);
    // Só nasceu, então está "pendente" — `aprovar` não devolve null aqui.
    if (aprovado) await aplicarEfeito(aprovado);

    log.info("cobrança aprovada em modo demonstração", {
      acao: "pagamentos.criar_cobranca",
      tipo,
    });

    return { pagamento: aprovado ?? pagamento, checkoutUrl: null };
  }

  const resultado = await criarPreferencia(
    {
      titulo: DESCRICAO_PAGAMENTO[tipo],
      valorCentavos: pagamento.valorCentavos,
      referenciaExterna: pagamento.id,
      urlRetorno: `${urlBase()}/pagamento/retorno?id=${pagamento.id}`,
      urlWebhook: `${urlBase()}/api/webhooks/mercado-pago`,
    },
    opcoes.buscar,
  );

  if (!resultado.ok) {
    log.warn("falha ao criar preferência no Mercado Pago", {
      acao: "pagamentos.criar_cobranca",
      tipo,
      motivo: resultado.motivo,
      detalhe: resultado.detalhe,
    });
    throw erros.indisponivel(resultado.motivo);
  }

  const atualizado = await repo.definirPreferencia(
    pagamento.id,
    resultado.preferencia.id,
  );

  log.info("preferência criada no Mercado Pago", {
    acao: "pagamentos.criar_cobranca",
    tipo,
  });

  return {
    pagamento: atualizado,
    checkoutUrl: resultado.preferencia.initPoint,
  };
}

/** Sete dias do Código de Defesa do Consumidor, em milissegundos. */
export const PRAZO_ESTORNO_MS = 7 * 24 * 60 * 60 * 1000;

export function dentroDoPrazoDeEstorno(pagamento: Pagamento): boolean {
  return Date.now() - new Date(pagamento.criadoEm).getTime() < PRAZO_ESTORNO_MS;
}

/** A cobrança que a pessoa ainda pode mandar estornar, se houver. */
export async function cobrancaEstornavel(
  sessao: Autenticado | null,
): Promise<Pagamento | null> {
  if (!sessao) return null;
  const ultimo = await repositorioPagamentos().ultimoAprovado(sessao.usuarioId);
  return ultimo && dentroDoPrazoDeEstorno(ultimo) ? ultimo : null;
}

/**
 * Devolve o dinheiro, a pedido de quem pagou (#168).
 *
 * Automático, sem fila: decisão do Luiz em 08/09/2026. O prazo é o do
 * arrependimento em compra online, contado da compra — passados sete dias
 * o botão some da tela e devolver vira caso de suporte.
 *
 * **A cobrança vem da sessão, nunca do formulário.** Aceitar um id daqui
 * deixaria alguém mandar estornar a cobrança de outra pessoa.
 *
 * **O efeito é aplicado aqui, e não esperando o webhook.** Quem apertou o
 * botão precisa ver o resultado; o `refunded` chega depois e encontra a
 * cobrança já `estornado` — `estornar` parte de `aprovado` e devolve
 * `null`, então nada acontece duas vezes. A idempotência que a #166
 * construiu é o que permite isto.
 *
 * **Falha do Mercado Pago não revoga nada.** Se o estorno não aconteceu, o
 * dinheiro não voltou: tirar a vitrine ali seria o pior dos dois mundos
 * para quem pediu.
 */
export async function pedirEstorno(
  sessao: Autenticado | null,
  buscar?: typeof fetch,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!sessao) throw erros.naoAutenticado("sem sessão");

  const pagamento = await repositorioPagamentos().ultimoAprovado(
    sessao.usuarioId,
  );

  if (!pagamento) {
    return { ok: false, motivo: "Não há pagamento a estornar." };
  }

  if (!dentroDoPrazoDeEstorno(pagamento)) {
    return {
      ok: false,
      motivo:
        "O prazo de sete dias para devolução já passou. Fale com o suporte.",
    };
  }

  /*
   * Em demonstração não há o que pedir ao Mercado Pago: a cobrança foi
   * aprovada sem ele. O efeito vale igual, que é o que a tela precisa
   * mostrar — mesma regra do `criarCobranca`.
   */
  if (temMercadoPagoConfigurado && pagamento.mpPaymentId) {
    const resultado = await estornarPagamento(pagamento.mpPaymentId, buscar);
    if (!resultado.ok) {
      log.warn("Mercado Pago recusou o estorno", {
        acao: "pagamentos.estornar",
      });
      return resultado;
    }
  }

  const estornado = await repositorioPagamentos().estornar(
    pagamento.id,
    pagamento.mpPaymentId,
  );
  if (estornado) await desfazerEfeito(estornado);

  log.info("estorno pedido pela pessoa", {
    acao: "pagamentos.estornar",
    tipo: pagamento.tipo,
  });

  return { ok: true };
}

/**
 * Relê o pagamento na API do Mercado Pago e aplica o efeito se aprovado.
 *
 * Chamado pelo webhook depois da assinatura validada — mas a assinatura
 * só prova que a notificação veio do Mercado Pago, não o que ela diz;
 * por isso o status em si vem sempre de uma nova chamada à API, nunca do
 * corpo do POST.
 */
export async function confirmarPagamento(
  mpPaymentId: string,
  buscar?: typeof fetch,
): Promise<void> {
  const infoRemota = await consultarPagamento(mpPaymentId, buscar);

  if (!infoRemota?.referenciaExterna) {
    log.warn("Mercado Pago não devolveu um pagamento reconhecível", {
      acao: "pagamentos.confirmar",
      mpPaymentId,
    });
    return;
  }

  const repo = repositorioPagamentos();
  const pagamento = await repo.porId(infoRemota.referenciaExterna);

  if (!pagamento) {
    log.warn("webhook aponta para uma cobrança que não existe aqui", {
      acao: "pagamentos.confirmar",
      mpPaymentId,
      referencia: infoRemota.referenciaExterna,
    });
    return;
  }

  if (infoRemota.status === "approved") {
    const aprovado = await repo.aprovar(pagamento.id, infoRemota.id);
    // `null`: outra notificação já tinha aprovado ou rejeitado antes —
    // o efeito já foi aplicado (ou nunca deveria ser), e reaplicar
    // dobraria o que a cobrança compra.
    if (aprovado) {
      await aplicarEfeito(aprovado);
      log.info("pagamento aprovado", {
        acao: "pagamentos.confirmar",
        tipo: pagamento.tipo,
      });
    }
    return;
  }

  if (infoRemota.status === "rejected") {
    await repo.rejeitar(pagamento.id, infoRemota.id);
    log.info("pagamento rejeitado", {
      acao: "pagamentos.confirmar",
      tipo: pagamento.tipo,
      status: infoRemota.status,
    });
    return;
  }

  if (infoRemota.status === "cancelled") {
    await repo.cancelar(pagamento.id, infoRemota.id);
    log.info("pagamento cancelado", {
      acao: "pagamentos.confirmar",
      tipo: pagamento.tipo,
    });
    return;
  }

  /*
   * Estorno e chargeback desfazem o que a aprovação comprou.
   *
   * Estes dois chegam **depois** de o dinheiro ter entrado, sobre uma
   * cobrança já `aprovado` — por isso `estornar` parte de "aprovado" e não
   * de "pendente", como os outros três.
   *
   * Sem este ramo, os dois caíam no "nada muda ainda" logo abaixo: o
   * prestador pagava, ganhava 30 dias, pedia estorno e continuava na
   * vitrine com o dinheiro de volta. Os valores `estornado` e `cancelado`
   * existiam no enum sem que nada no código os produzisse — estado
   * declarado sem produtor, que é a armadilha do `pedidos_verificacao` sem
   * tela de envio (#166).
   */
  if (
    infoRemota.status === "refunded" ||
    infoRemota.status === "charged_back"
  ) {
    const estornado = await repo.estornar(pagamento.id, infoRemota.id);
    // `null`: outra notificação já estornou, e o efeito já foi desfeito.
    if (estornado) {
      await desfazerEfeito(estornado);
      log.info("pagamento estornado", {
        acao: "pagamentos.confirmar",
        tipo: pagamento.tipo,
        status: infoRemota.status,
      });
    }
    return;
  }

  // "pending", "in_process" etc.: nada muda ainda — o Mercado Pago manda
  // outra notificação quando o status avançar.
}
