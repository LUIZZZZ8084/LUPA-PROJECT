import { NextResponse } from "next/server";
import { sessaoAtual } from "@/server/auth/cookies";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { repositorioPagamentos } from "@/server/pagamentos";

/**
 * Status de uma compra única, para a tela de retorno fazer polling.
 *
 * A irmã desta rota é `/api/assinaturas/[id]`, e as duas existem porque
 * as duas compras são coisas diferentes: quem assina espera a assinatura
 * ficar `ativa`, e quem compra crédito espera o **pagamento** ser
 * aprovado — não há assinatura nenhuma nesse caminho.
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
     * tenta ver a compra de outra pessoa — um 403 confirmaria que o id
     * existe, informação de graça para quem está sondando.
     */
    if (!sessao || !pagamento || pagamento.usuarioId !== sessao.usuarioId) {
      return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
    }

    log.info("status de compra consultado", {
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
