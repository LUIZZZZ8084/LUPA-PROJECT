import { NextResponse } from "next/server";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { avisarVagasVencendo } from "@/server/vagas/aviso-de-vencimento";
import { recusaDoCron } from "../portao";

/**
 * O aviso de vaga vencendo, disparado pelo cron da Vercel uma vez por dia
 * (#561). A regra mora em `avisarVagasVencendo`; aqui fica só o portão, o
 * mesmo da varredura de pagamentos.
 */

export const dynamic = "force-dynamic";
/** Um e-mail por empresa com vaga vencendo. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const recusa = recusaDoCron(request, {
      requestId,
      acao: "vagas.aviso_vencimento",
    });
    if (recusa) return recusa;

    const resultado = await avisarVagasVencendo();
    log.info("aviso de vencimento concluído", {
      requestId,
      acao: "vagas.aviso_vencimento",
      ...resultado,
      ms: medir(),
    });
    return NextResponse.json(resultado, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "vagas.aviso_vencimento", ms: medir() });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
