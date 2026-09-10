import { NextResponse } from "next/server";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { validarAssinaturaWebhook } from "@/server/pagamentos/mercadopago";
import {
  confirmarAssinatura,
  confirmarPagamento,
  confirmarParcelaDaAssinatura,
} from "@/server/pagamentos/servico";

/**
 * Webhook do Mercado Pago.
 *
 * Segunda rota do projeto, depois de `/api/admin/metricas` — e a primeira
 * pensada para um chamador que não é o navegador de alguém. Uma
 * server action não serviria: o Mercado Pago faz um POST comum, sem o
 * cabeçalho que o Next exige de uma action.
 *
 * A assinatura (`x-signature`) prova que a notificação veio do Mercado
 * Pago — não confirma o que ela diz. Toda confirmação relê o estado na
 * API deles antes de aplicar qualquer efeito; o corpo do POST só serve
 * para saber **qual** recurso consultar, e de que tipo ele é.
 *
 * São três tópicos, e o `data.id` de cada um aponta para um recurso
 * diferente. Tratar um pelo outro faz a consulta responder 404 e o efeito
 * nunca acontecer:
 *
 * | `type`                            | `data.id` é           |
 * |-----------------------------------|-----------------------|
 * | `payment`                         | um pagamento          |
 * | `subscription_preapproval`        | uma assinatura        |
 * | `subscription_authorized_payment` | uma parcela dela      |
 *
 * Os tópicos são marcados à mão no painel do Mercado Pago. Se
 * `subscription_authorized_payment` não estiver marcado, a renovação
 * ainda funciona: `confirmarPagamento` reconhece que a referência
 * externa aponta para uma assinatura e registra a parcela do mesmo jeito.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const corpo = (await request.json().catch(() => null)) as {
      type?: unknown;
      topic?: unknown;
      data?: { id?: unknown };
    } | null;

    const url = new URL(request.url);

    const dataId =
      corpo && typeof corpo.data?.id !== "undefined"
        ? String(corpo.data.id)
        : url.searchParams.get("data.id");

    if (!dataId) {
      log.warn("webhook do Mercado Pago sem id de pagamento", {
        requestId,
        acao: "webhook.mercado_pago",
      });
      return NextResponse.json({ erro: "sem id" }, { status: 400 });
    }

    const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "";
    const assinaturaValida = validarAssinaturaWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
      segredo,
    });

    if (!assinaturaValida) {
      log.warn("webhook do Mercado Pago com assinatura inválida", {
        requestId,
        acao: "webhook.mercado_pago",
      });
      return NextResponse.json(
        { erro: "assinatura inválida" },
        { status: 401 },
      );
    }

    /*
     * `type` é o campo das notificações v2; `topic` é o das antigas, e o
     * Mercado Pago ainda usa a query string em alguns avisos. Ler os três
     * é mais barato que descobrir, meses depois, que uma renovação nunca
     * chegou porque o aviso veio no formato velho.
     */
    const tipo =
      (typeof corpo?.type === "string" ? corpo.type : null) ??
      (typeof corpo?.topic === "string" ? corpo.topic : null) ??
      url.searchParams.get("type") ??
      url.searchParams.get("topic") ??
      "payment";

    await despachar(tipo, dataId);

    log.info("webhook do Mercado Pago processado", {
      requestId,
      acao: "webhook.mercado_pago",
      tipo,
      ms: medir(),
    });

    // 200 sempre que a assinatura bateu, mesmo se o pagamento não mudar
    // nada — 4xx/5xx faz o Mercado Pago reenviar, e reenviar um webhook
    // que já foi entendido só adiaria a resposta que ele já teve.
    return NextResponse.json({ ok: true });
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "webhook.mercado_pago", ms: medir() });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}

async function despachar(tipo: string, dataId: string): Promise<void> {
  switch (tipo) {
    case "subscription_preapproval":
    case "preapproval":
      return confirmarAssinatura(dataId);
    case "subscription_authorized_payment":
      return confirmarParcelaDaAssinatura(dataId);
    case "payment":
      return confirmarPagamento(dataId);
    default:
      // `subscription_preapproval_plan` e outros que não usamos. Nada a
      // fazer, e responder 200 é o certo: reenviar não mudaria nada.
      return;
  }
}
