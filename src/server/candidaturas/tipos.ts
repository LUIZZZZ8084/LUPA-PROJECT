/**
 * Candidaturas a vaga, e o estágio em que estão no processo da empresa.
 *
 * Segue o mesmo contrato de duas implementações do resto do servidor:
 * memória para o modo demonstração, Postgres para produção.
 */

export type StatusCandidatura =
  | "enviada"
  | "visualizada"
  | "contatada"
  | "entrevista"
  | "aprovada"
  | "contratada"
  | "rejeitada";

export interface Candidatura {
  id: string;
  vagaId: string;
  candidatoId: string;
  status: StatusCandidatura;
  criadoEm: string;
  /**
   * O que a pessoa respondeu às perguntas de triagem da vaga (#491), na
   * ordem delas: `true` é Sim. `null` quando a vaga não tinha pergunta — a
   * maioria, e toda candidatura anterior a elas.
   */
  respostas: boolean[] | null;
}

/**
 * Um acontecimento na vida da candidatura (#608): mudança de estágio, ou um
 * contato que a empresa registrou. Só a empresa lê.
 */
export type EventoDoHistorico = {
  id: string;
  candidaturaId: string;
  autorId: string | null;
  criadoEm: string;
} & (
  | { tipo: "etapa"; de: StatusCandidatura; para: StatusCandidatura }
  | { tipo: "contato"; nota: string }
);

export interface DadosNovaCandidatura {
  vagaId: string;
  candidatoId: string;
  respostas?: boolean[];
}

export interface RepositorioCandidaturas {
  porId(id: string): Promise<Candidatura | null>;
  porVaga(vagaId: string): Promise<Candidatura[]>;
  porCandidato(candidatoId: string): Promise<Candidatura[]>;
  /** Todas as candidaturas, de qualquer vaga — para montar o painel em demonstração. */
  listar(): Promise<Candidatura[]>;
  criar(dados: DadosNovaCandidatura): Promise<Candidatura>;
  /**
   * Move de estágio e grava o histórico na mesma operação (#608). `autorId`
   * é quem moveu; nulo quando foi o próprio sistema (abrir a ficha tira de
   * "Nova"). Mover para o estágio em que já está não grava nada.
   */
  moverEstagio(
    id: string,
    status: StatusCandidatura,
    autorId: string | null,
  ): Promise<Candidatura>;

  /** O histórico de uma candidatura, do mais recente para o mais antigo. */
  historicoDe(candidaturaId: string): Promise<EventoDoHistorico[]>;
}
