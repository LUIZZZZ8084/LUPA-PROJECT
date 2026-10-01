#!/usr/bin/env node
/**
 * Gera a lista de municípios do Brasil, por estado, a partir do IBGE.
 *
 *   node scripts/gerar-cidades.mjs
 *
 * POR QUE UM SCRIPT, E NÃO UMA LISTA DIGITADA
 * ───────────────────────────────────────────
 * São mais de 5.500 nomes, boa parte com acento e com "do/da/de" no meio.
 * Digitados à mão, um "Vila Bela da Santíssima Trindade" sai errado e
 * ninguém percebe — até alguém de lá não achar a própria cidade no
 * cadastro e concluir que o app não atende a região.
 *
 * A fonte é a API de localidades do IBGE, a mesma que os Correios e os
 * sistemas públicos usam. O resultado é gravado em arquivos `.ts`
 * versionados: em tempo de execução o app não fala com o IBGE nem com
 * ninguém — cadastro não pode depender de API de terceiro estar no ar.
 *
 * O QUE SAI DAQUI, E POR QUE EM TRÊS FORMAS
 * ─────────────────────────────────────────
 * - `src/lib/cidades/dados/<UF>.ts`: os nomes de um estado. Um arquivo por
 *   estado para o celular baixar só o do estado escolhido — o formulário
 *   não precisa de 5.500 nomes para alguém achar a própria cidade.
 * - `src/lib/cidades/indice.ts`: a lista de estados e um carregador sob
 *   demanda por estado. É o que o navegador importa.
 * - `src/lib/cidades/todas.ts`: tudo junto, marcado `server-only`, para o
 *   servidor validar o que chega. Se um dia um componente de cliente o
 *   importar, o build quebra em vez de mandar a lista inteira ao celular.
 *
 * A cidade é gravada com o estado ("Sinop - MT"): 232 nomes de município
 * se repetem entre estados, então o nome sozinho não identifica a cidade.
 *
 * QUANDO RODAR DE NOVO
 * ────────────────────
 * Quando o IBGE registrar município novo ou renomeado. Acontece: em 2025
 * Mato Grosso ganhou Boa Esperança do Norte. Os arquivos registram a data
 * da geração para essa conta ser possível depois.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL_IBGE =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

const PASTA = join(process.cwd(), "src", "lib", "cidades");
const DADOS = join(PASTA, "dados");

/*
 * Piso de sanidade. Se a API mudar de formato e devolver uma lista curta,
 * é melhor falhar aqui do que gravar meia lista e o app passar a recusar o
 * cadastro de quase todo mundo.
 */
const MINIMO_ESPERADO = 5500;
const ESTADOS_ESPERADOS = 27;

const resposta = await fetch(URL_IBGE);
if (!resposta.ok) {
  console.error(`IBGE respondeu ${resposta.status}. Nada foi gravado.`);
  process.exit(1);
}

const municipios = await resposta.json();

if (!Array.isArray(municipios) || municipios.length < MINIMO_ESPERADO) {
  console.error(
    `Resposta inesperada: ${municipios?.length ?? 0} municípios, ` +
      `esperava pelo menos ${MINIMO_ESPERADO}. Nada foi gravado.`,
  );
  process.exit(1);
}

/*
 * O estado vem da região intermediária, e não da microrregião: município
 * novo chega com `microrregiao: null` (Boa Esperança do Norte, MT, em
 * 2025), e ler dali derrubaria o script — ou pior, gravaria a cidade sem
 * estado.
 */
const porUf = new Map();
const nomesDosEstados = new Map();

for (const m of municipios) {
  const uf = m["regiao-imediata"]?.["regiao-intermediaria"]?.UF;
  if (!uf?.sigla || !m.nome) {
    console.error(
      `${m.nome ?? m.id} veio sem estado. O formato da API mudou; nada foi gravado.`,
    );
    process.exit(1);
  }
  nomesDosEstados.set(uf.sigla, uf.nome);
  if (!porUf.has(uf.sigla)) porUf.set(uf.sigla, []);
  porUf.get(uf.sigla).push(String(m.nome));
}

if (porUf.size !== ESTADOS_ESPERADOS) {
  console.error(
    `Vieram ${porUf.size} estados, esperava ${ESTADOS_ESPERADOS}. Nada foi gravado.`,
  );
  process.exit(1);
}

const siglas = [...porUf.keys()].sort();
const hoje = new Date().toISOString().slice(0, 10);

/*
 * No formato que o Biome já aplicaria — uma linha quando cabe (o DF tem um
 * município só), uma por nome quando não. Sem isto, gerar de novo
 * produziria diff de formatação sem nenhuma cidade mudar.
 */
function listaFormatada(nomes) {
  const emLinha = `[${nomes.map((n) => JSON.stringify(n)).join(", ")}]`;
  if (`export const CIDADES = ${emLinha} as const;`.length <= 80) {
    return emLinha;
  }
  return `[\n${nomes.map((n) => `  ${JSON.stringify(n)},`).join("\n")}\n]`;
}

// Recria a pasta de dados do zero: estado que sumisse ficaria órfão.
mkdirSync(DADOS, { recursive: true });
for (const arquivo of readdirSync(DADOS)) rmSync(join(DADOS, arquivo));

for (const sigla of siglas) {
  // `localeCompare` com pt-BR para "Águas" não cair depois de "Zortéa".
  const nomes = porUf.get(sigla).sort((a, b) => a.localeCompare(b, "pt-BR"));
  writeFileSync(
    join(DADOS, `${sigla}.ts`),
    `/**
 * Municípios de ${nomesDosEstados.get(sigla)} (${sigla}).
 *
 * GERADO POR \`node scripts/gerar-cidades.mjs\` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em ${hoje}.
 */

export const CIDADES = ${listaFormatada(nomes)} as const;
`,
    "utf8",
  );
}

writeFileSync(
  join(PASTA, "indice.ts"),
  `/**
 * Os estados, e como carregar as cidades de cada um.
 *
 * GERADO POR \`node scripts/gerar-cidades.mjs\` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em ${hoje}.
 *
 * Os carregadores são \`import()\` escritos um a um, e não um caminho
 * montado em tempo de execução: assim qualquer bundler separa cada estado
 * no próprio pedaço, e o celular baixa só o que a pessoa escolheu.
 */

export const UFS = [
${siglas.map((s) => `  { sigla: ${JSON.stringify(s)}, nome: ${JSON.stringify(nomesDosEstados.get(s))} },`).join("\n")}
] as const;

export type UF = (typeof UFS)[number]["sigla"];

export const CARREGADORES: Record<UF, () => Promise<readonly string[]>> = {
${siglas.map((s) => `  ${s}: () => import("./dados/${s}").then((m) => m.CIDADES),`).join("\n")}
};
`,
  "utf8",
);

writeFileSync(
  join(PASTA, "todas.ts"),
  `/**
 * Todos os municípios do Brasil, por estado — só no servidor.
 *
 * GERADO POR \`node scripts/gerar-cidades.mjs\` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em ${hoje}.
 *
 * \`server-only\` é a trava: são ${municipios.length} nomes, e um componente
 * de cliente que importasse isto mandaria todos ao celular. Com a trava,
 * o build quebra antes.
 */

import "server-only";

${siglas.map((s) => `import { CIDADES as ${s} } from "./dados/${s}";`).join("\n")}
import type { UF } from "./indice";

export const CIDADES_POR_UF: Record<UF, readonly string[]> = {
${siglas.map((s) => `  ${s},`).join("\n")}
};
`,
  "utf8",
);

console.log(
  `${municipios.length} municípios em ${siglas.length} estados gravados em ${PASTA}`,
);
