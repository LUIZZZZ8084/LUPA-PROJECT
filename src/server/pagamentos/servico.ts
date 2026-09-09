import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Autenticado } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { estenderMensalidade } from "../prestadores/servico";
import { repositorioPagamentos } from "./index";
import {
  consultarPagamento,
  criarPreferencia,
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

  if (infoRemota.status === "rejected" || infoRemota.status === "cancelled") {
    await repo.rejeitar(pagamento.id, infoRemota.id);
    log.info("pagamento rejeitado", {
      acao: "pagamentos.confirmar",
      tipo: pagamento.tipo,
      status: infoRemota.status,
    });
    return;
  }

  // "pending", "in_process" etc.: nada muda ainda — o Mercado Pago manda
  // outra notificação quando o status avançar.
}
