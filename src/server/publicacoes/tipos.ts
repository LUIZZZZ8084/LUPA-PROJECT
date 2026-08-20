/**
 * Publicações de perfil.
 *
 * Limite de 10 ativas por perfil nesta fase, para não sobrecarregar o
 * servidor enquanto a plataforma é validada. Arquivar libera vaga sem apagar
 * histórico — apagar de verdade tiraria da pessoa um trabalho que ela teve.
 */

export const LIMITE_PUBLICACOES_ATIVAS = 10;

export type StatusPublicacao = "ativa" | "arquivada";

export interface Publicacao {
  id: string;
  autorId: string;
  titulo: string;
  corpo: string;
  imagemUrl: string | null;
  status: StatusPublicacao;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovaPublicacao {
  autorId: string;
  titulo: string;
  corpo: string;
  imagemUrl?: string | null;
}

export interface RepositorioPublicacoes {
  porAutor(autorId: string, status?: StatusPublicacao): Promise<Publicacao[]>;
  porId(id: string): Promise<Publicacao | null>;
  contarAtivas(autorId: string): Promise<number>;
  criar(dados: DadosNovaPublicacao): Promise<Publicacao>;
  atualizar(
    id: string,
    campos: Partial<Pick<Publicacao, "titulo" | "corpo" | "imagemUrl">>,
  ): Promise<Publicacao>;
  definirStatus(id: string, status: StatusPublicacao): Promise<Publicacao>;
}
