import type { Papel } from "../auth/rbac";

/**
 * Métricas do painel administrativo.
 *
 * Três perguntas, que são as que decidem se o piloto em Sinop está de pé:
 * está entrando gente, está entrando dinheiro, e de onde essa gente vem.
 */

export interface CadastrosPorDia {
  /** Data no formato AAAA-MM-DD. */
  dia: string;
  total: number;
  porPapel: Record<Papel, number>;
}

export interface DistribuicaoLocal {
  cidade: string;
  bairro: string | null;
  total: number;
}

/**
 * Faturamento.
 *
 * Enquanto não houver integração de pagamento, isto é **derivado**: conta
 * quantas empresas estão no plano mensal e multiplica pelo preço de tabela.
 * Não é receita reconhecida, é projeção — e o painel diz isso na tela, para
 * ninguém tomar decisão achando que o dinheiro já entrou.
 */
export interface Faturamento {
  assinaturasAtivas: number;
  emTeste: number;
  precoMensal: number;
  receitaMensalEstimada: number;
  /** Falso enquanto o valor vier de contagem de planos, não de pagamento. */
  confirmado: boolean;
}

export interface Totais {
  usuarios: number;
  candidatos: number;
  prestadores: number;
  empresas: number;
  vagasAbertas: number;
}

export interface PainelAdmin {
  totais: Totais;
  cadastros: CadastrosPorDia[];
  locais: DistribuicaoLocal[];
  faturamento: Faturamento;
  /** Momento da apuração, para a tela mostrar há quanto tempo é o dado. */
  apuradoEm: string;
}

export interface RepositorioMetricas {
  totais(): Promise<Totais>;
  cadastrosPorDia(dias: number): Promise<CadastrosPorDia[]>;
  distribuicaoPorLocal(limite: number): Promise<DistribuicaoLocal[]>;
  planosDeEmpresa(): Promise<{ mensal: number; trial: number }>;
}
