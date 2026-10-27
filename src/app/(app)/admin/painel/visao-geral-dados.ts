import type {
  CadastrosPorDia,
  ContasNoLugar,
  Funil,
} from "@/server/metrics/tipos";

/*
 * As contas da visão geral do painel (#507), separadas da tela para serem
 * testadas sem desenhar nada. Nenhuma inventa número: tudo sai do que o
 * painel já recebe a cada 15 segundos.
 */

/**
 * Quanto da conta do mês a receita que se repete paga, de 0 a 1 — ou `null`
 * sem custo cadastrado, quando não há o que dividir e "100%" seria mentira.
 */
export function fracaoCoberta(
  recorrenteCentavos: number,
  custoCentavos: number,
): number | null {
  if (custoCentavos <= 0) return null;
  return Math.min(1, Math.max(0, recorrenteCentavos / custoCentavos));
}

export interface Ritmo {
  ultimos7: number;
  anteriores7: number;
  /** Variação de uma semana para a outra; `null` se a anterior foi zero. */
  variacao: number | null;
}

/**
 * Cadastros da última semana contra a semana antes dela.
 *
 * Semana contra semana, e não o mês inteiro contra o anterior, porque a
 * série tem 30 dias: comparar duas semanas cabe nela, e é a pergunta de quem
 * abre o painel ("está crescendo agora?"). Sem cadastro na semana anterior,
 * a variação não existe — "+∞%" não ajuda ninguém.
 */
export function ritmoDeCadastros(cadastros: CadastrosPorDia[]): Ritmo {
  const ordenados = [...cadastros].sort((a, b) => a.dia.localeCompare(b.dia));
  const soma = (dias: CadastrosPorDia[]) =>
    dias.reduce((s, d) => s + d.total, 0);
  const ultimos7 = soma(ordenados.slice(-7));
  const anteriores7 = soma(ordenados.slice(-14, -7));
  return {
    ultimos7,
    anteriores7,
    variacao: anteriores7 === 0 ? null : (ultimos7 - anteriores7) / anteriores7,
  };
}

/** As cinco regiões do IBGE, para colorir o mapa de contas por estado. */
export const REGIOES = [
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul",
] as const;
export type Regiao = (typeof REGIOES)[number] | "Sem estado";

const UFS_POR_REGIAO: Record<(typeof REGIOES)[number], string[]> = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
};

export function regiaoDaUf(uf: string): Regiao {
  for (const regiao of REGIOES) {
    if (UFS_POR_REGIAO[regiao].includes(uf)) return regiao;
  }
  return "Sem estado";
}

export type PapelDoMapa = "total" | "candidatos" | "prestadores" | "empresas";

/** Os estados com conta naquele papel, do maior para o menor. */
export function estadosDoPapel(
  estados: ContasNoLugar[],
  papel: PapelDoMapa,
): { uf: string; contas: number; regiao: Regiao }[] {
  return estados
    .map((e) => ({
      uf: e.lugar,
      contas: e[papel],
      regiao: regiaoDaUf(e.lugar),
    }))
    .filter((e) => e.contas > 0)
    .sort((a, b) => b.contas - a.contas || a.uf.localeCompare(b.uf));
}

export interface Retangulo<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Treemap "squarified": cada estado vira um retângulo de área proporcional
 * às contas, o mais perto possível de um quadrado. Recebe os itens do maior
 * para o menor.
 */
export function dividirEmRetangulos<T>(
  itens: { item: T; valor: number }[],
  largura: number,
  altura: number,
): Retangulo<T>[] {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  if (total <= 0 || largura <= 0 || altura <= 0) return [];

  const escala = (largura * altura) / total;
  let resto = itens
    .filter((i) => i.valor > 0)
    .map((i) => ({ ...i, area: i.valor * escala }));
  const saida: Retangulo<T>[] = [];
  let x = 0;
  let y = 0;
  let w = largura;
  let h = altura;

  const pior = (fila: typeof resto, lado: number) => {
    const soma = fila.reduce((s, r) => s + r.area, 0);
    const maior = Math.max(...fila.map((r) => r.area));
    const menor = Math.min(...fila.map((r) => r.area));
    return Math.max(
      (lado * lado * maior) / (soma * soma),
      (soma * soma) / (lado * lado * menor),
    );
  };

  while (resto.length > 0) {
    const lado = Math.min(w, h);
    const fila = [resto[0]];
    let i = 1;
    while (
      i < resto.length &&
      pior([...fila, resto[i]], lado) <= pior(fila, lado)
    ) {
      fila.push(resto[i]);
      i += 1;
    }
    resto = resto.slice(i);

    const soma = fila.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      const larguraDaColuna = soma / h;
      let cy = y;
      for (const r of fila) {
        const rh = r.area / larguraDaColuna;
        saida.push({ item: r.item, x, y: cy, w: larguraDaColuna, h: rh });
        cy += rh;
      }
      x += larguraDaColuna;
      w -= larguraDaColuna;
    } else {
      const alturaDaLinha = soma / w;
      let cx = x;
      for (const r of fila) {
        const rw = r.area / alturaDaLinha;
        saida.push({ item: r.item, x: cx, y, w: rw, h: alturaDaLinha });
        cx += rw;
      }
      y += alturaDaLinha;
      h -= alturaDaLinha;
    }
  }
  return saida;
}

export type PapelDoFunil = "candidatos" | "prestadores" | "empresas";

export interface PassoDoFunil {
  papel: PapelDoFunil;
  rotulo: string;
  chegaram: number;
  de: number;
  /** Fração do primeiro passo do papel; `null` sem ninguém no papel. */
  fracao: number | null;
}

/**
 * Os passos do funil depois do primeiro, cada um como fração de quem tem
 * conta no papel — a mesma conta do bloco "Funil" (#471): "20% das empresas
 * compraram" se lê sem conta.
 */
export function passosDoFunil(f: Funil): PassoDoFunil[] {
  const passo = (
    papel: PapelDoFunil,
    rotulo: string,
    chegaram: number,
    de: number,
  ): PassoDoFunil => ({
    papel,
    rotulo,
    chegaram,
    de,
    fracao: de > 0 ? chegaram / de : null,
  });

  return [
    passo("candidatos", "Visíveis", f.candidatosVisiveis, f.candidatos),
    passo(
      "candidatos",
      "Candidataram-se",
      f.candidatosQueSeCandidataram,
      f.candidatos,
    ),
    passo("prestadores", "Na vitrine", f.prestadoresNaVitrine, f.prestadores),
    passo("prestadores", "Assinantes", f.prestadoresAssinantes, f.prestadores),
    passo("empresas", "Conferidas", f.empresasVerificadas, f.empresas),
    passo("empresas", "Publicaram", f.empresasComVaga, f.empresas),
    passo("empresas", "Compraram", f.empresasQueCompraram, f.empresas),
  ];
}

/**
 * Onde o funil mais vaza: os passos com a menor fração, entre os que têm
 * gente no papel. É o que a pessoa olha primeiro para decidir o que mexer.
 */
export function maioresVazamentos(
  passos: PassoDoFunil[],
  quantos = 2,
): PassoDoFunil[] {
  return passos
    .filter((p) => p.fracao !== null)
    .sort((a, b) => (a.fracao ?? 0) - (b.fracao ?? 0))
    .slice(0, quantos);
}
