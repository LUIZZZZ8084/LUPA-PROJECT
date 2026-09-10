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
 * O caixa: o que entrou e o que saiu, em centavos.
 *
 * Deixou de ser projeção. Até 10/09/2026 este bloco contava empresas em
 * `perfis_empresa.plano` — coluna que nada escreve — e multiplicava por um
 * preço de tabela: um número que era sempre zero e se anunciava como
 * receita. Hoje sai de `pagamentos`, que é por onde o dinheiro passa.
 *
 * **As duas saídas ficam separadas de propósito.** Somadas dariam um total
 * certo e uma leitura errada: `estornado` foi devolução nossa, e
 * `contestado` é disputa aberta no cartão — custa taxa, é sinal de fraude
 * e dá para contestar de volta. Quem olha o painel precisa saber qual dos
 * dois está crescendo.
 *
 * **`recorrente` é a parte que se repete sozinha no mês que vem** —
 * mensalidade de prestador e plano mensal de vagas. O resto é compra
 * única: pacote de vagas e vaga avulsa não voltam sem alguém comprar de
 * novo, e misturar os dois faz um mês bom de pacotes parecer receita
 * previsível.
 */
export interface Caixa {
  entrouCentavos: number;
  estornadoCentavos: number;
  contestadoCentavos: number;
  /** Quanto do que entrou vem de assinatura, e não de compra única. */
  recorrenteCentavos: number;
  /** Entradas menos as duas saídas. */
  liquidoCentavos: number;
  cobrancas: number;
  contestacoes: number;
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
  caixa: Caixa;
  /** Momento da apuração, para a tela mostrar há quanto tempo é o dado. */
  apuradoEm: string;
}

export interface RepositorioMetricas {
  totais(): Promise<Totais>;
  cadastrosPorDia(dias: number): Promise<CadastrosPorDia[]>;
  distribuicaoPorLocal(limite: number): Promise<DistribuicaoLocal[]>;

  /**
   * O caixa, somado no banco e não na aplicação.
   *
   * Trazer `pagamentos` inteira para somar aqui funcionaria hoje, com duas
   * linhas, e pararia de funcionar sem avisar — a tabela só cresce, e o
   * painel recarrega a cada 15 segundos. `sum(...) filter (...)` faz isso
   * numa varredura só.
   */
  caixa(): Promise<Caixa>;
}
