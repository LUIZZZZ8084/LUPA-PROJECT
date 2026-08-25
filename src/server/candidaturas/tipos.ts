/**
 * Candidaturas a vaga, e o estágio em que estão no processo da empresa.
 *
 * Segue o mesmo contrato de duas implementações do resto do servidor:
 * memória para o modo demonstração, Postgres para produção.
 */

export type StatusCandidatura =
  | "enviada"
  | "visualizada"
  | "entrevista"
  | "aprovada"
  | "rejeitada";

export interface Candidatura {
  id: string;
  vagaId: string;
  candidatoId: string;
  status: StatusCandidatura;
  criadoEm: string;
}

export interface DadosNovaCandidatura {
  vagaId: string;
  candidatoId: string;
}

export interface RepositorioCandidaturas {
  porId(id: string): Promise<Candidatura | null>;
  porVaga(vagaId: string): Promise<Candidatura[]>;
  porCandidato(candidatoId: string): Promise<Candidatura[]>;
  /** Todas as candidaturas, de qualquer vaga — para montar o painel em demonstração. */
  listar(): Promise<Candidatura[]>;
  criar(dados: DadosNovaCandidatura): Promise<Candidatura>;
  moverEstagio(id: string, status: StatusCandidatura): Promise<Candidatura>;
}
