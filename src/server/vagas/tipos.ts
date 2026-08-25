/**
 * Vagas do painel da empresa.
 *
 * Publicar, editar e encerrar seguem o mesmo contrato de duas
 * implementações que o resto do servidor: o que os testes exercitam é o
 * mesmo caminho que roda em produção, e o modo demonstração continua
 * funcionando sem banco.
 */

export type StatusVaga = "aberta" | "fechada";

export interface Vaga {
  id: string;
  empresaId: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  cidade: string;
  bairro: string | null;
  tipoContrato: string | null;
  salarioMin: number | null;
  salarioMax: number | null;
  status: StatusVaga;
  criadoEm: string;
}

export interface DadosNovaVaga {
  empresaId: string;
  titulo: string;
  descricao: string;
  categoria: string;
  cidade: string;
  bairro?: string | null;
  tipoContrato: string;
  salarioMin?: number | null;
  salarioMax?: number | null;
}

export type EdicaoVaga = Partial<
  Pick<
    Vaga,
    | "titulo"
    | "descricao"
    | "categoria"
    | "cidade"
    | "bairro"
    | "tipoContrato"
    | "salarioMin"
    | "salarioMax"
  >
>;

export interface RepositorioVagas {
  porId(id: string): Promise<Vaga | null>;
  porEmpresa(empresaId: string): Promise<Vaga[]>;
  /** Todas as vagas, de qualquer empresa — usado pela busca pública. */
  listar(): Promise<Vaga[]>;
  criar(dados: DadosNovaVaga): Promise<Vaga>;
  atualizar(id: string, campos: EdicaoVaga): Promise<Vaga>;
  encerrar(id: string): Promise<Vaga>;
}
