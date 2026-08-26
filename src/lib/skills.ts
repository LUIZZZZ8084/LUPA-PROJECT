/**
 * Habilidades, comparáveis entre si.
 *
 * O campo `habilidades` nasceu como texto separado por vírgula, que é o
 * jeito certo de pedir no celular — a pessoa digita como fala. O preço é
 * que "Excel", "excel" e "EXCEL " são três coisas diferentes para o
 * computador, e comparação exata erra na maioria dos casos reais.
 *
 * Este módulo é a ponte: normaliza, conhece um punhado de sinônimos do
 * vocabulário daqui, e diz o quanto um candidato casa com uma vaga.
 *
 * Não é inteligência artificial, e não deveria ser. Numa cidade com
 * dezenas de vagas, uma tabela que qualquer um lê e corrige acerta mais do
 * que um modelo que ninguém consegue depurar — e não põe chamada de rede
 * no caminho de uma tela que abre em 3G.
 */

/**
 * Minúsculas, sem acento, espaço colapsado.
 *
 * Acento sai porque metade do público digita sem: "mecânico" e "mecanico"
 * são a mesma habilidade, e quem escreveu sem não pode ficar de fora.
 */
export function normalizarHabilidade(texto: string): string {
  return (
    texto
      .normalize("NFD")
      // A classe é a faixa dos acentos combinantes (U+0300 a U+036F). Ela
      // parece vazia no editor porque são caracteres que só desenham em
      // cima da letra anterior — o teste de normalização é que garante que
      // ela continua ali.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Sinônimos do vocabulário local.
 *
 * Cada linha é um grupo de coisas que significam a mesma na prática. A
 * lista é curta de propósito: cobre o que aparece de verdade nas vagas de
 * Sinop e região, e cresce quando alguém vir um caso que ela não pega —
 * não por antecipação.
 *
 * A forma canônica é a primeira de cada grupo, e é só um rótulo interno:
 * o que a tela mostra continua sendo o que a pessoa escreveu.
 */
const GRUPOS: readonly (readonly string[])[] = [
  // Agro — o que mais aparece por aqui.
  [
    "colheitadeira",
    "colhedora",
    "colheitadeira agricola",
    "maquina de colheita",
  ],
  ["trator", "tratorista", "operador de trator"],
  ["plantadeira", "plantio"],
  ["pulverizador", "pulverizacao", "aplicacao de defensivos"],
  ["analise de solo", "amostragem de solo"],

  // Habilitação. "CNH D" e "carteira D" são a mesma exigência.
  ["cnh a", "carteira a", "habilitacao a", "moto"],
  ["cnh b", "carteira b", "habilitacao b"],
  ["cnh c", "carteira c", "habilitacao c"],
  ["cnh d", "carteira d", "habilitacao d"],
  ["cnh e", "carteira e", "habilitacao e", "carreta", "bitrem"],

  // Logística e indústria.
  ["empilhadeira", "operador de empilhadeira"],
  ["almoxarifado", "estoque", "controle de estoque"],
  ["linha de producao", "producao", "chao de fabrica"],
  ["controle de qualidade", "qualidade", "inspecao de qualidade"],
  ["manutencao", "manutencao basica", "manutencao preventiva"],

  // Escritório.
  ["excel", "office", "planilha", "planilhas", "pacote office"],
  ["erp", "sistema de gestao", "totvs", "protheus"],
  ["conciliacao bancaria", "conciliacao"],
  ["contas a pagar", "financeiro", "contas a receber"],
  ["atendimento ao cliente", "atendimento", "recepcao"],

  // Comércio.
  ["vendas", "vendedor", "venda"],
  ["caixa", "operador de caixa", "frente de caixa"],

  // Construção.
  ["pedreiro", "alvenaria"],
  ["eletrica", "eletricista", "instalacao eletrica"],
  ["hidraulica", "encanador", "instalacao hidraulica"],
  ["pintura", "pintor"],
];

/** Cada variação aponta para a forma canônica do grupo dela. */
const CANONICA = new Map<string, string>();
for (const grupo of GRUPOS) {
  for (const variacao of grupo) CANONICA.set(variacao, grupo[0]);
}

/**
 * A forma pela qual duas habilidades se reconhecem.
 *
 * Sem sinônimo conhecido, é a própria normalização — o que faz o casamento
 * funcionar para qualquer habilidade, não só para as da tabela.
 */
export function formaCanonica(habilidade: string): string {
  const normal = normalizarHabilidade(habilidade);
  return CANONICA.get(normal) ?? normal;
}

/** Como a habilidade apareceu, e a forma pela qual ela casa. */
export interface HabilidadeCasada {
  /** O texto original, para mostrar na tela. */
  texto: string;
  canonica: string;
}

/**
 * Habilidades reconhecidas dentro de um texto corrido.
 *
 * Existe porque vaga antiga não declara habilidade nenhuma: são todas as
 * que já estavam publicadas quando o campo foi criado. Sem isto, o bloco
 * de recomendados nasceria vazio para todo mundo e ninguém veria valor
 * nele antes de preencher o campo — que é exatamente a ordem errada.
 *
 * Procura só o que a tabela conhece. Varrer palavra por palavra do texto
 * casaria "de", "para" e o nome da empresa.
 */
export function habilidadesNoTexto(texto: string): string[] {
  const normal = normalizarHabilidade(texto);
  const achadas = new Set<string>();

  for (const grupo of GRUPOS) {
    for (const variacao of grupo) {
      // Limite de palavra dos dois lados: "caixa" não pode casar dentro de
      // "caixaria", nem "vendas" dentro de "revendas".
      const padrao = new RegExp(`(^|\\s)${escapar(variacao)}($|\\s)`);
      if (padrao.test(normal)) {
        achadas.add(grupo[0]);
        break;
      }
    }
  }

  return [...achadas];
}

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** O que a vaga pede, vindo do campo ou, na falta dele, do texto. */
export function habilidadesDaVaga(vaga: {
  habilidades?: readonly string[] | null;
  titulo: string;
  descricao: string;
}): string[] {
  const declaradas = (vaga.habilidades ?? [])
    .map(formaCanonica)
    .filter(Boolean);
  if (declaradas.length > 0) return [...new Set(declaradas)];

  return habilidadesNoTexto(`${vaga.titulo} ${vaga.descricao}`);
}

export interface Casamento {
  /** Quantas habilidades da vaga o candidato tem. */
  pontos: number;
  /** Dessas, quantas por cento do que a vaga pede. 0 quando a vaga não pede nada. */
  proporcao: number;
  /** As habilidades que casaram, com o texto que o candidato escreveu. */
  casadas: HabilidadeCasada[];
}

/**
 * O quanto um candidato casa com uma vaga.
 *
 * Contagem simples, de propósito. Peso por habilidade, ou distância entre
 * termos, dariam um número mais bonito e impossível de explicar para a
 * empresa — e recomendação que não se explica é adivinhação: quem recebe
 * não tem como discordar do critério.
 */
export function casar(
  pedidas: readonly string[],
  habilidadesDoCandidato: readonly string[],
): Casamento {
  const doCandidato = new Map<string, string>();
  for (const h of habilidadesDoCandidato) {
    const canonica = formaCanonica(h);
    if (canonica && !doCandidato.has(canonica)) doCandidato.set(canonica, h);
  }

  /*
   * Os dois lados passam por `formaCanonica`, mesmo que `habilidadesDaVaga`
   * já devolva assim.
   *
   * Exigir entrada canônica de um lado só faria a função errar em silêncio
   * quando alguém a chamasse com o texto cru — que é o formato natural de
   * quem tem a lista na mão. Dedup depois de canonizar também impede que
   * "Excel, excel, office" na vaga contem como três exigências e derrubem
   * a proporção de todo mundo.
   */
  const pedidasCanonicas = new Set(pedidas.map(formaCanonica).filter(Boolean));

  const casadas: HabilidadeCasada[] = [];
  for (const pedida of pedidasCanonicas) {
    const texto = doCandidato.get(pedida);
    if (texto !== undefined) casadas.push({ texto, canonica: pedida });
  }

  const total = pedidasCanonicas.size;
  return {
    pontos: casadas.length,
    proporcao: total === 0 ? 0 : casadas.length / total,
    casadas,
  };
}
