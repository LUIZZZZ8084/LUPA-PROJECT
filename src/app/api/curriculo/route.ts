import { NextResponse } from "next/server";
import { sessaoAtual } from "@/server/auth/cookies";
import { gerarCurriculoDoCandidato } from "@/server/curriculo/servico";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";

/**
 * Gera e devolve o currículo em PDF de quem está pedindo (#47).
 *
 * Não fica em Storage nenhum — é montado aqui, a cada chamada, a partir
 * do perfil como ele está agora. `gerarCurriculoDoCandidato` faz as duas
 * checagens: o papel pode gerar (`candidato:gerar_curriculo`) e já pagou
 * (`geradorCurriculoLiberado`); sem qualquer uma das duas, a chamada
 * lança e cai no catch abaixo.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const sessao = await sessaoAtual();
    const pdf = await gerarCurriculoDoCandidato(sessao);

    log.info("currículo gerado", {
      requestId,
      acao: "curriculo.gerar",
      ms: medir(),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="curriculo.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "curriculo.gerar", ms: medir() });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
