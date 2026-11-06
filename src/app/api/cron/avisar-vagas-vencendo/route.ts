import { avisarVagasVencendo } from "@/server/vagas/aviso-de-vencimento";
import { executarVarredura } from "../executar";

/**
 * O aviso de vaga vencendo, disparado pelo agendamento da Vercel uma vez
 * por dia (#561, #565). A regra mora em `avisarVagasVencendo`; o portão, o
 * log e o registro que o painel do admin lê, em `executarVarredura` (#566).
 */

export const dynamic = "force-dynamic";
/** Um e-mail por empresa com vaga vencendo. */
export const maxDuration = 60;

export function GET(request: Request) {
  return executarVarredura(request, {
    nome: "avisar-vagas-vencendo",
    acao: "vagas.aviso_vencimento",
    concluida: "aviso de vencimento concluído",
    rodar: () => avisarVagasVencendo(),
  });
}
