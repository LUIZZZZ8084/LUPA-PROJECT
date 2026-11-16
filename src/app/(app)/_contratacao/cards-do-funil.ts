import { mensagemParaCandidato } from "@/lib/chamada";
import { formatarEntrevista } from "@/lib/entrevista";
import { timeAgo, whatsappLink } from "@/lib/format";
import { motivosDeNaoAtender } from "@/lib/triagem";
import type { ApplicationWithCandidate, JobListing } from "@/lib/types";
import { acompanhamentosDe } from "@/server/acompanhamento/servico";
import { matchPorCandidatura } from "@/server/candidaturas/match";
import type { CardDoFunil } from "./quadro-do-funil";

/**
 * Os cards do quadro, a partir das candidaturas da empresa (#612).
 *
 * Um lugar só para a aba Candidatos e para a página do processo de cada
 * vaga: montados em cada tela, uma delas esqueceria a etiqueta ou a
 * entrevista, e o mesmo candidato teria dois cards diferentes.
 *
 * `todas` são todas as candidaturas da empresa, e não só as que viram card:
 * a % de casamento é calculada sobre o conjunto, como no painel.
 */
export async function montarCardsDoFunil({
  candidaturas,
  todas,
  vagas,
  nomeDaEmpresa,
}: {
  candidaturas: readonly ApplicationWithCandidate[];
  todas: readonly ApplicationWithCandidate[];
  vagas: readonly JobListing[];
  nomeDaEmpresa: string;
}): Promise<CardDoFunil[]> {
  const match = matchPorCandidatura(todas, vagas);
  const acompanhamentos = await acompanhamentosDe(
    candidaturas.map((c) => c.id),
  );

  return candidaturas.map((c) => {
    const m = match.get(c.id);
    const acompanhamento = acompanhamentos.get(c.id);
    const entrevistaEm = acompanhamento?.entrevistaEm;
    return {
      id: c.id,
      nome: c.candidate.full_name,
      avatar: c.candidate.avatar_url,
      vagaId: c.job_id,
      vaga: c.job_title,
      status: c.status,
      ha: timeAgo(c.created_at),
      match: m
        ? {
            porcentagem: m.porcentagem,
            pontos: m.pontos,
            deQuantas: m.deQuantas,
          }
        : null,
      motivos: motivosDeNaoAtender(c.job_questions ?? [], c.answers),
      whatsapp: c.candidate.phone
        ? whatsappLink(
            c.candidate.phone,
            mensagemParaCandidato({
              candidato: c.candidate.full_name,
              vaga: c.job_title,
              empresa: nomeDaEmpresa,
            }),
          )
        : null,
      entrevista: entrevistaEm ? formatarEntrevista(entrevistaEm) : null,
      etiquetas: acompanhamento?.etiquetas ?? [],
    };
  });
}
