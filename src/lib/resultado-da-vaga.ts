/**
 * O resultado de cada vaga, no painel da empresa (#492).
 *
 * A empresa publica, espera, e não via o que a Lupa fez por ela. Sem prova de
 * resultado ela não renova — o Instagram também não mostra, mas é de graça. O
 * que a Lupa tem a mais é justamente o que o Instagram não tem: visualizações,
 * candidaturas e quantas delas combinam com o que a vaga pede, juntas, no fim
 * da vaga.
 *
 * Mora fora do painel para ser pura e testável: a conta é de contagem, e o que
 * se protege é o número que a empresa lê.
 */

/**
 * A partir de quantos por cento a candidatura é "muito compatível".
 *
 * É o mesmo corte que pinta o selo de casamento da lista de currículos de
 * verde (`SeloDeMatch`): o resumo da vaga e o selo da linha precisam dizer a
 * mesma coisa, ou a empresa soma os verdes da lista e não acha o número do
 * resumo.
 */
export const LIMIAR_MUITO_COMPATIVEL = 70;

export interface ResultadoDaVaga {
  /** Desde a publicação. Serve para comparar vagas, não para contar pessoas. */
  visualizacoes: number;
  candidaturas: number;
  /**
   * Das candidaturas que dá para comparar com a vaga, quantas casam a partir
   * de `LIMIAR_MUITO_COMPATIVEL`. **`null` quando nenhuma dá para comparar**:
   * zero é uma afirmação ("comparei, e ninguém combina"), e só sai quando é
   * verdade — vaga que não declara habilidade, ou candidatura de quem não
   * declarou nenhuma, não entra na conta.
   */
  muitoCompativeis: number | null;
}

export function resultadosDasVagas(
  vagas: readonly { id: string; applicant_count: number }[],
  candidaturas: readonly { id: string; job_id: string }[],
  match: ReadonlyMap<string, { porcentagem: number }>,
  visualizacoes: ReadonlyMap<string, number>,
): Map<string, ResultadoDaVaga> {
  const comparaveis = new Map<string, number>();
  const compativeis = new Map<string, number>();

  for (const c of candidaturas) {
    const m = match.get(c.id);
    if (!m) continue;
    comparaveis.set(c.job_id, (comparaveis.get(c.job_id) ?? 0) + 1);
    if (m.porcentagem >= LIMIAR_MUITO_COMPATIVEL) {
      compativeis.set(c.job_id, (compativeis.get(c.job_id) ?? 0) + 1);
    }
  }

  return new Map(
    vagas.map((v) => [
      v.id,
      {
        visualizacoes: visualizacoes.get(v.id) ?? 0,
        candidaturas: v.applicant_count,
        muitoCompativeis: comparaveis.has(v.id)
          ? (compativeis.get(v.id) ?? 0)
          : null,
      },
    ]),
  );
}
