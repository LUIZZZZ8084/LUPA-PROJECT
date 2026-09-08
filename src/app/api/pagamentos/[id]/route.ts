import { NextResponse } from "next/server";
import { sessaoAtual } from "@/server/auth/cookies";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { repositorioPagamentos } from "@/server/pagamentos";

/**
 * Status de um pagamento, para a tela de retorno fazer polling.
 *
 * Rota em vez de server action pelo mesmo motivo de `/api/admin/metricas`:
 * o cliente refaz a chamada num intervalo, e `fetch` para uma rota cancela
 * e cacheia melhor do que reinvocar uma action.
 *
 * Quem confirma de verdade é o webhook — esta rota só lê o que já está
 * gravado, nunca consulta o Mercado Pago.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = novoRequestId();
  const medir = cronometro();
  const { id } = await params;

  try {
    const sessao = await sessaoAtual();
    const pagamento = await repositorioPagamentos().porId(id);

    /*
     * "Não encontrado" tanto para quem não tem sessão quanto para quem
     * tenta ver o pagamento de outra pessoa — um 403 confirmaria que o id
     * existe, informação de graça para quem está sondando.
     */
    if (!sessao || !pagamento || pagamento.usuarioId !== sessao.usuarioId) {
      return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
    }

    log.info("status de pagamento consultado", {
      requestId,
      acao: "pagamentos.status",
      papel: sessao.papel,
      ms: medir(),
    });

    return NextResponse.json(
      { status: pagamento.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "pagamentos.status", ms: medir() });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
