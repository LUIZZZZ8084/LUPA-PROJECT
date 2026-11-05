/**
 * A entrevista marcada na ficha da candidatura (#539), como a tela a mostra.
 *
 * A hora é de parede — `2026-11-06T14:30`, sem fuso — e é lida pedaço por
 * pedaço, nunca por `new Date()`: o servidor roda em UTC, e converter a
 * string mudaria a hora que a empresa escreveu.
 */

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** "2026-11-06T14:30" → "qui, 06/11 às 14:30". */
export function formatarEntrevista(em: string): string {
  const [data, hora = ""] = em.split("T");
  const [ano, mes, dia] = data.split("-").map(Number);
  const semana = DIAS[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  return `${semana}, ${dd}/${mm} às ${hora.slice(0, 5)}`;
}

/**
 * O dia de hoje, como `2026-11-05`, no horário de Brasília.
 *
 * É a régua de "próxima" e "passou": a Lupa atende o Brasil inteiro, e o
 * fuso de cada empresa não é guardado. Brasília erra por uma hora em Mato
 * Grosso e por duas no Acre, e nos dois casos só na virada do dia — a
 * entrevista das 23h de ontem ainda aparece por uma hora. Para uma lista de
 * próximas entrevistas, é um erro que não engana ninguém.
 */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** As entrevistas de hoje em diante, da mais próxima para a mais distante. */
export function entrevistasProximas<T extends { entrevistaEm: string | null }>(
  lista: readonly T[],
  hoje: string,
): (T & { entrevistaEm: string })[] {
  return lista
    .filter(
      (a): a is T & { entrevistaEm: string } =>
        a.entrevistaEm !== null && a.entrevistaEm.slice(0, 10) >= hoje,
    )
    .sort((a, b) => a.entrevistaEm.localeCompare(b.entrevistaEm));
}
