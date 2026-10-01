#!/usr/bin/env node
/**
 * Gera o mapa de regiões de todos os municípios do Brasil, a partir do
 * IBGE.
 *
 *   node scripts/gerar-regioes.mjs
 *
 * POR QUE ISTO EXISTE
 * ───────────────────
 * A busca precisa responder "o que está mais perto de quem está olhando".
 * A API de localidades do IBGE não devolve latitude e longitude — devolve
 * algo mais adequado ao caso: **região imediata** e **região
 * intermediária**.
 *
 * A região imediata é definida pelo deslocamento real das pessoas para
 * bens e serviços. É exatamente a pergunta que interessa a um app de
 * emprego: até onde alguém daqui viaja para trabalhar. Distância em linha
 * reta seria pior, além de exigir outra fonte: quem decide o tempo de
 * viagem é a estrada, e 200km de asfalto não são 200km de terra.
 *
 * As regiões são gravadas pelo **id** do IBGE, não pelo nome: nome de
 * região se repete entre estados, e duas regiões "Santa Rita" em estados
 * diferentes não são a mesma região.
 *
 * Mesmo arranjo do `gerar-cidades.mjs`: o resultado é um `.ts` versionado,
 * e em tempo de execução o app não fala com o IBGE. Busca não pode depender
 * de API de terceiro estar no ar.
 *
 * QUANDO RODAR DE NOVO
 * ────────────────────
 * Junto com `gerar-cidades.mjs`, quando o IBGE registrar município novo ou
 * renomeado. O IBGE também revisa a divisão regional de tempos em tempos —
 * a última foi a de 2017, que substituiu micro e mesorregiões por
 * imediatas e intermediárias.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const URL_IBGE =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

const DESTINO = join(process.cwd(), "src", "lib", "regioes.ts");

/*
 * Mesmo piso de sanidade do gerador de cidades: resposta curta significa
 * formato mudado, e é melhor falhar aqui do que gravar meia lista e a
 * busca passar a ordenar errado sem ninguém perceber.
 */
const MINIMO_ESPERADO = 5500;

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
 * A intermediária vem aninhada dentro da imediata, não no topo do objeto.
 * Ler no lugar errado devolve `undefined` para todo mundo — o mapa fica
 * completo, o script termina com sucesso e a ordenação passa a empatar o
 * país inteiro no mesmo degrau.
 */
const entradas = municipios.map((m) => {
  const imediata = m["regiao-imediata"];
  const intermediaria = imediata?.["regiao-intermediaria"];
  const uf = intermediaria?.UF?.sigla;

  if (!imediata?.id || !intermediaria?.id || !uf) {
    console.error(
      `${m.nome} veio sem região ou estado. ` +
        "O formato da API mudou; nada foi gravado.",
    );
    process.exit(1);
  }

  return [`${m.nome} - ${uf}`, Number(imediata.id), Number(intermediaria.id)];
});

entradas.sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

const imediatas = new Set(entradas.map((e) => e[1]));
const intermediarias = new Set(entradas.map((e) => e[2]));

const hoje = new Date().toISOString().slice(0, 10);

const conteudo = `/**
 * Região de cada município do Brasil, na divisão regional do IBGE.
 *
 * GERADO POR \`node scripts/gerar-regioes.mjs\` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em ${hoje}.
 *
 * ${entradas.length} municípios, ${imediatas.size} regiões imediatas,
 * ${intermediarias.size} intermediárias. As regiões vão pelo id do IBGE,
 * porque nome de região se repete entre estados.
 *
 * Só no servidor: quem consome isto é \`src/lib/proximidade.ts\`, e a busca
 * ordena antes de a página sair. Mandar este mapa ao celular seria
 * centenas de kB para nada.
 */

import "server-only";

/** "Cidade - UF" → [id da região imediata, id da região intermediária] */
export const REGIOES: Record<string, readonly [number, number]> = {
${entradas
  .map(
    ([cidade, imediata, intermediaria]) =>
      `  ${JSON.stringify(cidade)}: [${imediata}, ${intermediaria}],`,
  )
  .join("\n")}
};
`;

writeFileSync(DESTINO, conteudo, "utf8");

console.log(
  `${entradas.length} municípios gravados em ${DESTINO} ` +
    `(${imediatas.size} regiões imediatas, ${intermediarias.size} intermediárias)`,
);
