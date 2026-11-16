#!/usr/bin/env node
/**
 * Gera os avatares desenhados dos perfis de teste.
 *
 * **Desde a #614 só uma parte dos exemplos usa avatar desenhado.** Os 9
 * prestadores têm retrato fotográfico gerado por IA e três empresas têm
 * logo própria, em `.webp`, fora deste script. Os candidatos e as outras
 * três empresas continuam saindo daqui. Rodar de novo não toca nos
 * `.webp`.
 *
 *   node scripts/gerar-avatares.mjs
 *
 * ORIGEM E LICENÇA DAS IMAGENS
 * ────────────────────────────
 * Nenhuma foto de pessoa real é usada. Todos os avatares são gerados
 * localmente pelo DiceBear, sem chamada de rede, a partir de coleções em
 * domínio público:
 *
 *   • Lorelei — Lisa Wischofsky, CC0 1.0 (domínio público)
 *     https://www.figma.com/community/file/1198749693280469639
 *     Usada para as pessoas: prestadores e candidatos.
 *
 *   • Shapes — DiceBear, CC0 1.0 (domínio público)
 *     Usada para as empresas: formas abstratas, sem sugerir uma marca real.
 *
 *   • Biblioteca DiceBear — MIT.
 *     https://www.dicebear.com
 *
 * CC0 dispensa atribuição, mas fica registrada aqui de qualquer forma: quem
 * mantiver este projeto depois precisa saber de onde as imagens vieram sem
 * ter de investigar.
 *
 * A semente é o identificador do perfil, então o mesmo perfil gera sempre o
 * mesmo avatar — rodar de novo não embaralha as caras da demonstração.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { lorelei, shapes } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

const DESTINO = join(process.cwd(), "public", "avatares");

/** Paleta do app, para os avatares não destoarem do tema escuro. */
const FUNDOS = ["121821", "161d28", "1b2330"];

const PESSOAS = [
  "cnd-everton-rodrigues",
  "cnd-wesley-barbosa",
  "cnd-adriano-klein",
  "cnd-simone-batista",
  "cnd-priscila-nogueira",
  "cnd-lucas-trindade",
];

const EMPRESAS = [
  "cmp-bom-preco",
  "cmp-transportes-brasil",
  "cmp-clinica-vida",
];

async function gerar(colecao, seed) {
  const svg = createAvatar(colecao, {
    seed,
    size: 256,
    backgroundColor: FUNDOS,
    radius: colecao === shapes ? 12 : 50,
  }).toString();

  await writeFile(join(DESTINO, `${seed}.svg`), svg, "utf8");
  return svg.length;
}

async function principal() {
  await mkdir(DESTINO, { recursive: true });

  let bytes = 0;
  for (const seed of PESSOAS) bytes += await gerar(lorelei, seed);
  for (const seed of EMPRESAS) bytes += await gerar(shapes, seed);

  const total = PESSOAS.length + EMPRESAS.length;
  console.log(
    `${total} avatares em public/avatares (${Math.round(bytes / 1024)} KB).`,
  );
  console.log("Lorelei e Shapes, ambas CC0 1.0. Nenhuma foto de pessoa real.");
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
