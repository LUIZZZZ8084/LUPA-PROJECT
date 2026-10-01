/**
 * Os estados, e como carregar as cidades de cada um.
 *
 * GERADO POR `node scripts/gerar-cidades.mjs` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em 2026-10-01.
 *
 * Os carregadores são `import()` escritos um a um, e não um caminho
 * montado em tempo de execução: assim qualquer bundler separa cada estado
 * no próprio pedaço, e o celular baixa só o que a pessoa escolheu.
 */

export const UFS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "TO", nome: "Tocantins" },
] as const;

export type UF = (typeof UFS)[number]["sigla"];

export const CARREGADORES: Record<UF, () => Promise<readonly string[]>> = {
  AC: () => import("./dados/AC").then((m) => m.CIDADES),
  AL: () => import("./dados/AL").then((m) => m.CIDADES),
  AM: () => import("./dados/AM").then((m) => m.CIDADES),
  AP: () => import("./dados/AP").then((m) => m.CIDADES),
  BA: () => import("./dados/BA").then((m) => m.CIDADES),
  CE: () => import("./dados/CE").then((m) => m.CIDADES),
  DF: () => import("./dados/DF").then((m) => m.CIDADES),
  ES: () => import("./dados/ES").then((m) => m.CIDADES),
  GO: () => import("./dados/GO").then((m) => m.CIDADES),
  MA: () => import("./dados/MA").then((m) => m.CIDADES),
  MG: () => import("./dados/MG").then((m) => m.CIDADES),
  MS: () => import("./dados/MS").then((m) => m.CIDADES),
  MT: () => import("./dados/MT").then((m) => m.CIDADES),
  PA: () => import("./dados/PA").then((m) => m.CIDADES),
  PB: () => import("./dados/PB").then((m) => m.CIDADES),
  PE: () => import("./dados/PE").then((m) => m.CIDADES),
  PI: () => import("./dados/PI").then((m) => m.CIDADES),
  PR: () => import("./dados/PR").then((m) => m.CIDADES),
  RJ: () => import("./dados/RJ").then((m) => m.CIDADES),
  RN: () => import("./dados/RN").then((m) => m.CIDADES),
  RO: () => import("./dados/RO").then((m) => m.CIDADES),
  RR: () => import("./dados/RR").then((m) => m.CIDADES),
  RS: () => import("./dados/RS").then((m) => m.CIDADES),
  SC: () => import("./dados/SC").then((m) => m.CIDADES),
  SE: () => import("./dados/SE").then((m) => m.CIDADES),
  SP: () => import("./dados/SP").then((m) => m.CIDADES),
  TO: () => import("./dados/TO").then((m) => m.CIDADES),
};
