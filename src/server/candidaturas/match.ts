import { casar, habilidadesDaVaga } from "@/lib/skills";
import type { ApplicationWithCandidate, JobListing } from "@/lib/types";

/**
 * Quanto cada candidatura casa com a vaga a que ela responde.
 *
 * O bloco "Recomendados para você" já dizia isso, mas só dos três
 * primeiros de cada vaga e só depois de a empresa rolar a página até lá.
 * Na lista de currículos recebidos — que é por onde a empresa realmente
 * passa — o número não aparecia, e o critério ficava escondido justamente
 * de quem precisa dele para decidir a ordem de ligar.
 *
 * O cálculo é o mesmo, de `casar()`: contagem simples do que a vaga pede
 * contra o que o candidato declarou, com a tabela de sinônimos de
 * `src/lib/skills.ts` no meio. Um segundo cálculo, mesmo equivalente,
 * daria dois números para a mesma pergunta na mesma tela — e o dia em que
 * divergissem, ninguém saberia qual acreditar.
 */

export interface MatchDaCandidatura {
  /** Quantas das habilidades que a vaga pede o candidato tem. */
  pontos: number;
  /** Quantas a vaga pede. */
  deQuantas: number;
  /** De 0 a 100, arredondado — é o que a tela mostra. */
  porcentagem: number;
}

/**
 * Indexado por id de candidatura.
 *
 * **Zero é uma afirmação, e por isso só sai quando é verdade.** "0%" diz
 * à empresa "eu comparei, e este candidato não tem nada do que vocês
 * pedem" — o que basta para alguém não ser chamado. Só pode aparecer
 * quando os dois lados falaram:
 *
 * - Vaga que não declara habilidade e cujo título não dá pista fica fora.
 * - **Candidato que não declarou habilidade nenhuma também fica fora** —
 *   e este é o caso comum, não o raro: o cadastro não pede habilidade,
 *   ela entra depois em `/perfil/editar`. Sem esta metade, todo mundo
 *   recém-cadastrado apareceria com 0% ao lado do nome, e a empresa
 *   aprenderia a ignorar o selo — ou, pior, descartaria quem só não
 *   preencheu um campo.
 *
 * Ausência no mapa quer dizer "não dá para dizer", e a tela não desenha
 * selo nenhum. É diferente de dizer zero.
 */
export function matchPorCandidatura(
  candidaturas: readonly ApplicationWithCandidate[],
  vagas: readonly JobListing[],
): Map<string, MatchDaCandidatura> {
  const pedidasPorVaga = new Map<string, string[]>();
  for (const vaga of vagas) {
    pedidasPorVaga.set(
      vaga.id,
      habilidadesDaVaga({
        habilidades: vaga.skills,
        titulo: vaga.title,
        descricao: vaga.description,
      }),
    );
  }

  const saida = new Map<string, MatchDaCandidatura>();

  for (const c of candidaturas) {
    const pedidas = pedidasPorVaga.get(c.job_id);
    if (!pedidas || pedidas.length === 0) continue;
    if (c.candidate.skills.length === 0) continue;

    const { pontos, proporcao } = casar(pedidas, c.candidate.skills);
    saida.set(c.id, {
      pontos,
      deQuantas: pedidas.length,
      porcentagem: Math.round(proporcao * 100),
    });
  }

  return saida;
}
