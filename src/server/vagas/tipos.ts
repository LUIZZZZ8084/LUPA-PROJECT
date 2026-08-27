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
  /** Rua, número, referência — texto livre, informativo. `null` em vaga
   * publicada antes deste campo existir; nunca decide ranking. */
  endereco: string | null;
  tipoContrato: string | null;
  salarioMin: number | null;
  salarioMax: number | null;
  habilidades: string[];
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
  endereco: string;
  tipoContrato: string;
  salarioMin?: number | null;
  salarioMax?: number | null;
  habilidades?: string[];
}

export type EdicaoVaga = Partial<
  Pick<
    Vaga,
    | "titulo"
    | "descricao"
    | "categoria"
    | "cidade"
    | "bairro"
    | "endereco"
    | "habilidades"
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
