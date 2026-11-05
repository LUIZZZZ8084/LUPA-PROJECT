/**
 * O que a empresa anota sobre uma candidatura, e a entrevista marcada (#539).
 *
 * Só da empresa dona da vaga: quem se candidatou nunca lê isto. Mesmo
 * contrato de duas implementações do resto do servidor — memória para a
 * demonstração, Postgres para produção.
 */

export interface Acompanhamento {
  candidaturaId: string;
  /** Texto livre, até 2000 letras. Vazio quando só a entrevista foi marcada. */
  anotacao: string;
  /**
   * Hora de parede da entrevista, como `2026-11-06T14:30` — sem fuso, porque
   * é a hora no relógio de quem vai, na cidade da vaga. `null` sem entrevista.
   */
  entrevistaEm: string | null;
  entrevistaLocal: string | null;
  atualizadoEm: string;
}

export type DadosAcompanhamento = Omit<Acompanhamento, "atualizadoEm">;

export interface RepositorioAcompanhamento {
  porCandidatura(candidaturaId: string): Promise<Acompanhamento | null>;
  /** Os acompanhamentos destas candidaturas; as que não têm, ficam de fora. */
  porCandidaturas(candidaturaIds: readonly string[]): Promise<Acompanhamento[]>;
  salvar(dados: DadosAcompanhamento): Promise<Acompanhamento>;
}
