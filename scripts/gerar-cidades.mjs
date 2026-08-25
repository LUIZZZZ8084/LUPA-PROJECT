#!/usr/bin/env node
/**
 * Gera a lista de municípios de Mato Grosso a partir do IBGE.
 *
 *   node scripts/gerar-cidades.mjs
 *
 * POR QUE UM SCRIPT, E NÃO UMA LISTA DIGITADA
 * ───────────────────────────────────────────
 * São 142 nomes, boa parte com acento e com "do/da/de" no meio. Digitados
 * à mão, um "Vila Bela da Santíssima Trindade" sai errado e ninguém
 * percebe — até alguém de lá não achar a própria cidade no cadastro e
 * concluir que o app não atende a região.
 *
 * A fonte é a API de localidades do IBGE, que é a mesma que os Correios e
 * os sistemas públicos usam. O resultado é gravado num arquivo `.ts`
 * versionado: em tempo de execução o app não fala com o IBGE nem com
 * ninguém — cadastro não pode depender de API de terceiro estar no ar.
 *
 * QUANDO RODAR DE NOVO
 * ────────────────────
 * Só quando Mato Grosso criar ou renomear município. Acontece: em 2025 o
 * estado passou de 141 para 142 com a instalação de Boa Esperança do
 * Norte. O arquivo gerado registra a data da geração para essa conta ser
 * possível depois.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const URL_IBGE =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/MT/municipios";

const DESTINO = join(process.cwd(), "src", "lib", "cidades-mt.ts");

/*
 * Piso de sanidade. Se a API mudar de formato e devolver uma lista curta,
 * é melhor falhar aqui do que gravar um arquivo com três cidades e o app
 * passar a recusar o cadastro de quase todo mundo.
 */
const MINIMO_ESPERADO = 100;

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

// `localeCompare` com pt-BR para "Águas" não cair depois de "Zortéa".
const nomes = municipios
  .map((m) => String(m.nome))
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

const hoje = new Date().toISOString().slice(0, 10);

const conteudo = `/**
 * Municípios de Mato Grosso.
 *
 * GERADO POR \`node scripts/gerar-cidades.mjs\` — não edite à mão.
 * Fonte: API de localidades do IBGE. Gerado em ${hoje}.
 *
 * Fica em arquivo próprio, e não em \`constants.ts\`, porque é dado
 * gerado: misturar dado gerado com constante escrita à mão é como se
 * perde uma edição manual na próxima geração.
 */

export const CIDADES_MT = [
${nomes.map((n) => `  ${JSON.stringify(n)},`).join("\n")}
] as const;
`;

writeFileSync(DESTINO, conteudo, "utf8");

console.log(`${nomes.length} municípios gravados em ${DESTINO}`);
