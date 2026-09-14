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

/**
 * Quanto cada teto está sendo pressionado **agora** (#207).
 *
 * Não é série histórica, e não vai virar uma: a fonte é
 * `tentativas_de_acesso`, que se limpa sozinha algumas janelas depois. A
 * Issue nasceu pedindo tabela nova com contagem por dia, e a decisão do
 * Luiz em 14/09/2026 foi não criar: volume por rota a Vercel já conta — é
 * o medidor da fatura dela, que é o teto que chega primeiro —, e o sinal
 * que faltava já estava no banco. O que não se tem é histórico, e
 * histórico é justamente a parte que guarda dado.
 *
 * **Nada aqui identifica ninguém, e isso é garantido pelo banco.**
 * `tentativas_de_acesso.chave` é `login:<e-mail>`, `cadastro:<ip>`,
 * `recuperacao:<ip>` ou `acao:<nome>:u:<usuarioId>` — tem endereço de
 * e-mail dentro. A agregação mora na view `metricas_pressao` para que a
 * chave nunca atravesse a fronteira do banco: o que chega aqui já é
 * contagem. Deixar a garantia em "ninguém vai renderizar essa coluna"
 * seria confiar numa promessa em vez de num arranjo.
 */
export interface PressaoNoTeto {
  /**
   * A ação (`vaga.publicar`), ou o prefixo da chave nas três de
   * autenticação (`login`, `cadastro`, `recuperacao`) — onde o resto da
   * chave é o e-mail ou o endereço, e fica para trás de propósito.
   */
  rotulo: string;
  /** Quantas chaves distintas estão contando na janela. */
  chaves: number;
  /** Chamadas somadas, de todas as chaves. */
  chamadas: number;
  /** Quantas dessas chaves estão bloqueadas neste momento. */
  bloqueadas: number;
  /** A maior contagem de uma chave só. */
  pico: number;
}

/**
 * O rótulo de uma chave de limite — a metade que pode ser mostrada.
 *
 * Espelha o `case`/`split_part` da view `metricas_pressao`, e existe em
 * TypeScript porque o modo demonstração não tem banco. As duas precisam
 * concordar, e há teste no `schema.test.ts` que passa o mesmo conjunto de
 * chaves pelas duas e compara — duplicação de regra de *parsing* entre
 * linguagens é a que diverge sem ninguém ver.
 *
 * Para `acao:<nome>:...` o rótulo é o nome da ação, que vem de
 * `ORCAMENTOS` — literal do nosso código, nunca entrada de usuário. Para
 * as outras é só o prefixo.
 */
export function rotuloDaChave(chave: string): string {
  const partes = chave.split(":");
  return chave.startsWith("acao:") ? (partes[1] ?? "") : partes[0];
}

/** Uma janela de limite, do jeito que os dois repositórios a enxergam. */
export interface JanelaDeLimite {
  chave: string;
  tentativas: number;
  bloqueadoAte: Date | null;
}

/**
 * A mesma agregação da view `metricas_pressao`, em memória.
 *
 * Existe para o modo demonstração, que não tem banco — e é função pura de
 * propósito: é ela que o teste compara, linha a linha, com o resultado da
 * view rodando num Postgres de verdade. Regra de agregação escrita em duas
 * linguagens diverge sem ninguém ver; a única defesa é executar as duas
 * sobre a mesma entrada.
 */
export function agregarPressao(
  janelas: JanelaDeLimite[],
  agora: Date,
): PressaoNoTeto[] {
  const porRotulo = new Map<string, PressaoNoTeto>();

  for (const janela of janelas) {
    const rotulo = rotuloDaChave(janela.chave);
    const atual = porRotulo.get(rotulo) ?? {
      rotulo,
      chaves: 0,
      chamadas: 0,
      bloqueadas: 0,
      pico: 0,
    };

    atual.chaves += 1;
    atual.chamadas += janela.tentativas;
    atual.pico = Math.max(atual.pico, janela.tentativas);
    if (janela.bloqueadoAte && janela.bloqueadoAte > agora)
      atual.bloqueadas += 1;

    porRotulo.set(rotulo, atual);
  }

  return [...porRotulo.values()].sort(
    (a, b) => b.bloqueadas - a.bloqueadas || b.chamadas - a.chamadas,
  );
}

export interface PainelAdmin {
  totais: Totais;
  cadastros: CadastrosPorDia[];
  locais: DistribuicaoLocal[];
  caixa: Caixa;
  /** Quem está encostando nos tetos agora, da maior pressão para a menor. */
  pressao: PressaoNoTeto[];
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

  /**
   * A pressão em cada teto, agregada, da maior para a menor.
   *
   * Agregada **no banco**, e não aqui: além da chave não poder sair de lá,
   * trazer `tentativas_de_acesso` inteira para somar funcionaria hoje e
   * pararia de funcionar exatamente sob abuso — que é o único momento em
   * que alguém abre este bloco. Mesmo raciocínio de `caixa()`.
   */
  pressaoNosTetos(limite: number): Promise<PressaoNoTeto[]>;
}
