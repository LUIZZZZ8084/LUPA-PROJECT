import type { Papel } from "../auth/rbac";
import type { CustoMensal } from "../custos/tipos";

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

/**
 * Uma linha de contas num lugar — um estado ou uma cidade —, por papel
 * (#471). O admin não entra, nem a conta excluída (#423).
 */
export interface ContasNoLugar {
  /** A sigla do estado, ou a cidade com o estado ("Sinop - MT"). */
  lugar: string;
  candidatos: number;
  prestadores: number;
  empresas: number;
  total: number;
}

export interface ContasPorLugar {
  /** Todos os estados com alguma conta, do maior para o menor. */
  estados: ContasNoLugar[];
  /** As cidades com mais contas, até o limite pedido. */
  cidades: ContasNoLugar[];
}

/** Como a tela chama o lugar que a conta não diz qual é. */
export const SEM_ESTADO = "Sem estado";
export const SEM_CIDADE = "Sem cidade";

/**
 * O estado de uma cidade gravada como "Sinop - MT", do jeito da view.
 *
 * Espelha `substring(cidade from ' - ([A-Z]{2})$')` em
 * `metricas_contas_por_estado`: só o sufixo " - XX" no fim conta, e o resto
 * é nulo. Não usa `ufDaCidade`, de `src/lib/cidades`, de propósito — aquela
 * é a regra da aplicação, e esta precisa ser a regra do banco, para as duas
 * contagens baterem. O `schema.test.ts` passa as mesmas cidades pelas duas.
 */
export function ufNaMetrica(cidade: string | null): string | null {
  return / - ([A-Z]{2})$/.exec(cidade ?? "")?.[1] ?? null;
}

/** O que uma conta precisa ter para entrar nas contas por lugar. */
export interface ContaNoMapa {
  papel: Papel;
  cidade: string | null;
  excluida: boolean;
}

/** Ordem das linhas: do maior para o menor, e por nome no empate. */
export function ordenarLugares(a: ContasNoLugar, b: ContasNoLugar): number {
  return b.total - a.total || a.lugar.localeCompare(b.lugar, "pt-BR");
}

/**
 * Contas por estado e por cidade, em memória — a mesma conta das views
 * `metricas_contas_por_estado` e `metricas_contas_por_cidade`.
 *
 * Existe para o modo demonstração, e é função pura de propósito: é ela que
 * o `schema.test.ts` compara com as views num Postgres de verdade.
 */
export function agregarContasPorLugar(
  contas: ReadonlyArray<ContaNoMapa>,
  limiteDeCidades: number,
): ContasPorLugar {
  const estados = new Map<string, ContasNoLugar>();
  const cidades = new Map<string, ContasNoLugar>();

  const somar = (
    mapa: Map<string, ContasNoLugar>,
    lugar: string,
    papel: Papel,
  ) => {
    const linha = mapa.get(lugar) ?? {
      lugar,
      candidatos: 0,
      prestadores: 0,
      empresas: 0,
      total: 0,
    };
    if (papel === "candidato_clt") linha.candidatos += 1;
    if (papel === "prestador_servico") linha.prestadores += 1;
    if (papel === "empresa") linha.empresas += 1;
    linha.total += 1;
    mapa.set(lugar, linha);
  };

  for (const conta of contas) {
    if (conta.papel === "admin" || conta.excluida) continue;
    somar(estados, ufNaMetrica(conta.cidade) ?? SEM_ESTADO, conta.papel);
    somar(cidades, conta.cidade ?? SEM_CIDADE, conta.papel);
  }

  return {
    estados: [...estados.values()].sort(ordenarLugares),
    cidades: [...cidades.values()]
      .sort(ordenarLugares)
      .slice(0, limiteDeCidades),
  };
}

/**
 * O caminho de cada papel até virar receita, e a receita que se repete
 * (#471). É a pergunta do Luiz em 15/10/2026: quanto falta para o Lupa
 * pagar o próprio custo — e, faltando, em que passo cada um para.
 */
export interface Funil {
  candidatos: number;
  /** Ligaram "quero que empresas me encontrem". */
  candidatosVisiveis: number;
  /** Mandaram pelo menos uma candidatura. */
  candidatosQueSeCandidataram: number;
  prestadores: number;
  /** CPF conferido e mensalidade em dia: aparecem em `/servicos`. */
  prestadoresNaVitrine: number;
  /** Com a mensalidade em assinatura ativa, teste grátis inclusive. */
  prestadoresAssinantes: number;
  empresas: number;
  /** CNPJ conferido na Receita, ou cadastro por CPF. */
  empresasVerificadas: number;
  empresasComVaga: number;
  empresasQueCompraram: number;
  receita: {
    assinaturasAtivas: number;
    /** O valor de cada assinatura ativa, somado: o que volta todo mês. */
    recorrenteAtivoCentavos: number;
    /** Tudo o que foi aprovado nos últimos 30 dias, pacotes inclusive. */
    entrouUltimos30DiasCentavos: number;
  };
}

/** O que o funil lê, nos dois repositórios. */
export interface EntradaDoFunil {
  contas: ReadonlyArray<{
    id: string;
    papel: Papel;
    docVerificado: boolean;
    excluida: boolean;
  }>;
  perfisDeCandidato: ReadonlyArray<{
    usuarioId: string;
    visivelParaEmpresas: boolean;
  }>;
  perfisDePrestador: ReadonlyArray<{
    usuarioId: string;
    mensalidadeValidaAte: string | null;
  }>;
  candidaturas: ReadonlyArray<{ candidatoId: string }>;
  vagas: ReadonlyArray<{ empresaId: string }>;
  assinaturas: ReadonlyArray<{
    usuarioId: string;
    tipo: string;
    status: string;
    valorCentavos: number;
  }>;
  pagamentos: ReadonlyArray<{
    usuarioId: string;
    tipo: string;
    status: string;
    valorCentavos: number;
    criadoEm: string;
  }>;
  agora: Date;
}

/**
 * Os `empresa_pacote_*` ficam: deixaram de ser vendidos na #489, mas há
 * compra aprovada com eles, e quem comprou um pacote comprou.
 */
const COMPRAS_DE_EMPRESA = new Set([
  "empresa_vaga_avulsa",
  "empresa_pacote_5",
  "empresa_pacote_10",
  "empresa_plano_5",
  "empresa_plano_10",
  "empresa_mensal",
]);

/** O que se repete sozinho todo mês: a mesma lista de `metricas_caixa`. */
export const TIPOS_RECORRENTES_NO_CAIXA = new Set([
  "prestador_mensalidade",
  "empresa_plano_5",
  "empresa_plano_10",
  "empresa_mensal",
]);

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * O funil em memória — a mesma regra da view `metricas_funil`, para o modo
 * demonstração. O `schema.test.ts` roda as duas sobre a mesma entrada e
 * compara.
 */
export function montarFunil(e: EntradaDoFunil): Funil {
  const contas = new Map(
    e.contas
      .filter((c) => c.papel !== "admin" && !c.excluida)
      .map((c) => [c.id, c]),
  );
  const doPapel = (papel: Papel) =>
    [...contas.values()].filter((c) => c.papel === papel);
  const ehDoPapel = (id: string, papel: Papel) =>
    contas.get(id)?.papel === papel;
  const distintos = (ids: string[]) => new Set(ids).size;

  const visiveis = new Set(
    e.perfisDeCandidato
      .filter((p) => p.visivelParaEmpresas)
      .map((p) => p.usuarioId),
  );
  const emDia = new Set(
    e.perfisDePrestador
      .filter(
        (p) =>
          p.mensalidadeValidaAte !== null &&
          new Date(p.mensalidadeValidaAte) > e.agora,
      )
      .map((p) => p.usuarioId),
  );
  const ativas = e.assinaturas.filter((a) => a.status === "ativa");
  const desde = e.agora.getTime() - TRINTA_DIAS_MS;

  return {
    candidatos: doPapel("candidato_clt").length,
    candidatosVisiveis: doPapel("candidato_clt").filter((c) =>
      visiveis.has(c.id),
    ).length,
    candidatosQueSeCandidataram: distintos(
      e.candidaturas
        .map((c) => c.candidatoId)
        .filter((id) => ehDoPapel(id, "candidato_clt")),
    ),
    prestadores: doPapel("prestador_servico").length,
    prestadoresNaVitrine: doPapel("prestador_servico").filter(
      (c) => c.docVerificado && emDia.has(c.id),
    ).length,
    prestadoresAssinantes: distintos(
      ativas
        .filter(
          (a) => a.tipo === "prestador_mensalidade" && contas.has(a.usuarioId),
        )
        .map((a) => a.usuarioId),
    ),
    empresas: doPapel("empresa").length,
    empresasVerificadas: doPapel("empresa").filter((c) => c.docVerificado)
      .length,
    empresasComVaga: distintos(
      e.vagas.map((v) => v.empresaId).filter((id) => ehDoPapel(id, "empresa")),
    ),
    empresasQueCompraram: distintos(
      e.pagamentos
        .filter(
          (p) =>
            p.status === "aprovado" &&
            COMPRAS_DE_EMPRESA.has(p.tipo) &&
            ehDoPapel(p.usuarioId, "empresa"),
        )
        .map((p) => p.usuarioId),
    ),
    receita: {
      assinaturasAtivas: ativas.length,
      recorrenteAtivoCentavos: ativas.reduce((s, a) => s + a.valorCentavos, 0),
      entrouUltimos30DiasCentavos: e.pagamentos
        .filter(
          (p) =>
            p.status === "aprovado" && new Date(p.criadoEm).getTime() > desde,
        )
        .reduce((s, p) => s + p.valorCentavos, 0),
    },
  };
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
  lugares: ContasPorLugar;
  funil: Funil;
  /** A meta do mês: o custo dos planos que o Lupa precisa pagar. */
  custos: CustoMensal[];
  caixa: Caixa;
  /** Quem está encostando nos tetos agora, da maior pressão para a menor. */
  pressao: PressaoNoTeto[];
  /** Momento da apuração, para a tela mostrar há quanto tempo é o dado. */
  apuradoEm: string;
}

export interface RepositorioMetricas {
  totais(): Promise<Totais>;
  cadastrosPorDia(dias: number): Promise<CadastrosPorDia[]>;
  contasPorLugar(limiteDeCidades: number): Promise<ContasPorLugar>;
  funil(): Promise<Funil>;

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
