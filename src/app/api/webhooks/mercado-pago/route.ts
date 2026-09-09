import { NextResponse } from "next/server";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { validarAssinaturaWebhook } from "@/server/pagamentos/mercadopago";
import { confirmarPagamento } from "@/server/pagamentos/servico";

/**
 * Webhook do Mercado Pago.
 *
 * Segunda rota do projeto, depois de `/api/admin/metricas` — e a primeira
 * pensada para um chamador que não é o navegador de alguém. Uma
 * server action não serviria: o Mercado Pago faz um POST comum, sem o
 * cabeçalho que o Next exige de uma action.
 *
 * A assinatura (`x-signature`) prova que a notificação veio do Mercado
 * Pago — não confirma o que ela diz. `confirmarPagamento` sempre releria
 * o status na API deles antes de aplicar qualquer efeito; o corpo do
 * POST só serve para saber qual pagamento consultar.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const corpo = (await request.json().catch(() => null)) as {
      type?: unknown;
      data?: { id?: unknown };
    } | null;

    const dataId =
      corpo && typeof corpo.data?.id !== "undefined"
        ? String(corpo.data.id)
        : new URL(request.url).searchParams.get("data.id");

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

    await confirmarPagamento(dataId);

    log.info("webhook do Mercado Pago processado", {
      requestId,
      acao: "webhook.mercado_pago",
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
