import { ufDaCidade } from "./cidades";
import { REGIOES } from "./regioes";

/**
 * Quão perto de quem está olhando.
 *
 * A busca cobre o Brasil inteiro desde a #301 (e Mato Grosso, antes dela,
 * desde a #76). Ordenar só por data faz a primeira coisa que alguém de
 * Sinop vê ser uma vaga em Porto Alegre — o oposto do que "perto de você"
 * promete.
 *
 * MEDIR PERTO SEM COORDENADAS
 * ───────────────────────────
 * A API do IBGE que já gera a lista de municípios não devolve latitude e
 * longitude, mas devolve **região imediata** e **região intermediária**,
 * para os 5.571 municípios do país.
 *
 * A região imediata agrupa municípios pelo deslocamento real das pessoas
 * para bens e serviços. É a pergunta certa para um app de emprego — até
 * onde alguém daqui viaja para trabalhar — e é melhor que linha reta num
 * estado onde quem decide o tempo de viagem é a estrada: 200km de asfalto
 * e 200km de terra não são a mesma distância. Duas cidades na mesma região
 * imediata já são, por definição, cidades entre as quais se circula.
 *
 * Depois da intermediária vem o **estado**, que não precisa de mapa
 * nenhum: está no próprio valor gravado ("Sinop - MT"). É o degrau que
 * separa "longe, mas no mesmo estado" de "outro canto do país".
 *
 * ORDENAR NÃO É FILTRAR
 * ─────────────────────
 * Nada sai da lista por estar longe. O grau só decide a ordem, e o filtro
 * de cidade continua sendo a forma de restringir — a lição da #76, onde um
 * padrão posto na tela virou filtro invisível e escondeu vaga de gente que
 * tinha acabado de publicar.
 */

/** Menor é mais perto. */
export const GRAU = {
  MESMO_BAIRRO: 0,
  MESMA_CIDADE: 1,
  MESMA_REGIAO_IMEDIATA: 2,
  MESMA_REGIAO_INTERMEDIARIA: 3,
  MESMO_ESTADO: 4,
  RESTO_DO_PAIS: 5,
} as const;

export interface Origem {
  cidade: string;
  bairro?: string | null;
}

export interface Local {
  cidade: string;
  bairro?: string | null;
  /**
   * Bairros que o prestador declara atender.
   *
   * Para prestador, "perto" é onde ele trabalha, não onde ele mora. O
   * eletricista que mora no Jacarandá e atende o Centro está perto de quem
   * é do Centro — usar o endereço dele responderia a pergunta errada.
   */
  atende?: readonly string[] | null;
}

/** Minúsculas e sem acento: "Jd. Botânico" e "jd botanico" são o mesmo. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const mesmoTexto = (
  a: string | null | undefined,
  b: string | null | undefined,
) => Boolean(a && b && norm(a) === norm(b));

/**
 * Em que degrau da escada este item está, visto de `origem`.
 *
 * Sem origem — sessão sem cidade, que não deveria acontecer porque o
 * cadastro exige uma — todo mundo empata no último degrau. Empate faz a
 * ordenação cair no desempate de sempre (data, ou nota), que é o
 * comportamento anterior a esta funcionalidade. Errar para o lado do
 * comportamento antigo é mais seguro que errar para uma ordem inventada.
 */
export function grauDeProximidade(
  origem: Origem | null | undefined,
  local: Local,
): number {
  if (!origem?.cidade) return GRAU.RESTO_DO_PAIS;

  if (mesmoTexto(origem.cidade, local.cidade)) {
    const atendeOBairro = (local.atende ?? []).some((b) =>
      mesmoTexto(b, origem.bairro),
    );
    return mesmoTexto(origem.bairro, local.bairro) || atendeOBairro
      ? GRAU.MESMO_BAIRRO
      : GRAU.MESMA_CIDADE;
  }

  const daOrigem = REGIOES[origem.cidade];
  const doLocal = REGIOES[local.cidade];

  if (daOrigem && doLocal) {
    if (daOrigem[0] === doLocal[0]) return GRAU.MESMA_REGIAO_IMEDIATA;
    if (daOrigem[1] === doLocal[1]) return GRAU.MESMA_REGIAO_INTERMEDIARIA;
  }

  /*
   * Cidade fora do mapa não quebra: cai no degrau do estado, que vem do
   * próprio valor, ou no último. Acontece com dado gravado antes da
   * migração para "Cidade - UF" e com município novo entre a criação pelo
   * IBGE e alguém rodar o gerador de novo.
   */
  const ufOrigem = ufDaCidade(origem.cidade);
  if (ufOrigem && ufOrigem === ufDaCidade(local.cidade)) {
    return GRAU.MESMO_ESTADO;
  }
  return GRAU.RESTO_DO_PAIS;
}

/**
 * Comparador que põe o mais perto primeiro e desempata como a lista já
 * desempatava.
 *
 * O desempate entra por parâmetro porque as duas listas ordenam por coisas
 * diferentes: vaga pela data, prestador pela nota. Fixar um dos dois aqui
 * faria a outra tela mudar de comportamento sem ninguém pedir.
 */
export function porProximidade<T>(
  origem: Origem | null | undefined,
  localDe: (item: T) => Local,
  desempate: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => {
    const diferenca =
      grauDeProximidade(origem, localDe(a)) -
      grauDeProximidade(origem, localDe(b));
    return diferenca !== 0 ? diferenca : desempate(a, b);
  };
}
