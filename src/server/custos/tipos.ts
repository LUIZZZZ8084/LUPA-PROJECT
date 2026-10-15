/**
 * Um custo mensal que o Lupa precisa cobrir para se pagar (#471, #473).
 *
 * O valor é em centavos, como todo dinheiro do app, e é por mês: o bloco
 * "O Lupa já se paga?" o compara com a receita que se repete todo mês.
 */
export interface CustoMensal {
  id: string;
  nome: string;
  centavos: number;
}

/** O que se cadastra ou se edita num custo. */
export interface DadosDoCusto {
  nome: string;
  centavos: number;
}

/**
 * Os custos na ordem de cadastro, que é a ordem de cobertura: a receita
 * paga o primeiro inteiro antes de chegar ao segundo.
 */
export interface RepositorioCustos {
  listar(): Promise<CustoMensal[]>;
  criar(dados: DadosDoCusto): Promise<CustoMensal>;
  /** `null` quando o custo não existe. */
  atualizar(id: string, dados: DadosDoCusto): Promise<CustoMensal | null>;
  /** `false` quando o custo não existe. */
  remover(id: string): Promise<boolean>;
}
