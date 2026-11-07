import { NextResponse } from "next/server";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { registrarExecucao } from "@/server/varreduras";
import type {
  NomeDaVarredura,
  ResumoDaVarredura,
} from "@/server/varreduras/tipos";
import { recusaDoCron } from "./portao";

/**
 * O caminho comum das rotas de cron: o portão, o trabalho, o log e o
 * registro que o painel do admin lê (#566).
 *
 * As duas rotas repetiam o mesmo esqueleto; com o registro entrando, eram
 * três passos a lembrar em cada uma, e a varredura que esquecesse de
 * registrar apareceria no painel como atrasada sem estar.
 *
 * **O que se registra:** sucesso com o resumo, exceção com o código do
 * erro, e o 503 de segredo ausente — esse é a configuração quebrada, e o
 * painel precisa dizer. **O 401 não se registra:** de fora, segredo
 * divergente e alguém batendo na porta sem ser a Vercel são a mesma
 * requisição, e gravar cada tentativa de fora seria deixar qualquer um
 * escrever no painel. O segredo divergente aparece pelo outro lado: a
 * varredura fica sem sucesso e vira "atrasada".
 */
export async function executarVarredura<T extends object>(
  request: Request,
  varredura: {
    nome: NomeDaVarredura;
    acao: string;
    concluida: string;
    rodar: () => Promise<T>;
  },
): Promise<NextResponse> {
  const { nome, acao } = varredura;
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const recusa = recusaDoCron(request, { requestId, acao });
    if (recusa) {
      if (recusa.status === 503) {
        await registrarExecucao(nome, {
          ok: false,
          resumo: { erro: "CRON_SECRET ausente" },
        });
      }
      return recusa;
    }

    const resultado = await varredura.rodar();
    log.info(varredura.concluida, {
      requestId,
      acao,
      ...resultado,
      ms: medir(),
    });
    // Os resultados das varreduras são contagens: cabem no resumo como estão.
    await registrarExecucao(nome, {
      ok: true,
      resumo: resultado as ResumoDaVarredura,
    });
    return NextResponse.json(resultado, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao, ms: medir() });
    await registrarExecucao(nome, {
      ok: false,
      resumo: { erro: erro.codigo },
    });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
