#!/usr/bin/env node
/**
 * Gera o ícone da aba do navegador (`src/app/favicon.ico`).
 *
 *   node scripts/gerar-favicon.mjs
 *
 * O arquivo que estava lá desde o primeiro commit era o de fábrica do
 * Next — o triângulo preto. A logo da Lupa já existia em `icon.tsx` e
 * `apple-icon.tsx`, e o HTML declara os dois ícones, mas quem escolhe é o
 * navegador: o Chrome prefere o `.ico`, declarado com `sizes="any"`, e a
 * aba mostrava o triângulo (#303).
 *
 * O desenho é o mesmo do `icon.tsx`, e as cores também: `ImageResponse`
 * não lê o `@theme`, então elas moram em três lugares, e há teste
 * (`tests/unit/favicon.test.ts`) que cobra que este arquivo e o
 * `icon.tsx` não se separem.
 *
 * O `.ico` leva um PNG por tamanho (16, 32 e 48 px), formato que todo
 * navegador atual lê. Sem dependência nova: o `sharp` já é do projeto.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const FUNDO = "#0b0f14";
export const LENTE = "#a8d94a";
export const VISTO = "#f2f5f8";

const TAMANHOS = [16, 32, 48];

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <rect width="48" height="48" rx="10" fill="${FUNDO}"/>
  <g transform="translate(4.8 4.8) scale(0.8)">
    <circle cx="21" cy="21" r="14" stroke="${LENTE}" stroke-width="4"/>
    <line x1="31" y1="31" x2="43" y2="43" stroke="${LENTE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M15 21 L19 25 L28 15" stroke="${VISTO}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

/** O contêiner ICO: cabeçalho, uma entrada por imagem, e os PNGs. */
function montarIco(pngs) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(pngs.length, 4);

  const entradas = [];
  let deslocamento = 6 + 16 * pngs.length;
  for (const { tamanho, dados } of pngs) {
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(tamanho, 0);
    entrada.writeUInt8(tamanho, 1);
    entrada.writeUInt8(0, 2); // sem paleta
    entrada.writeUInt8(0, 3);
    entrada.writeUInt16LE(1, 4); // planos
    entrada.writeUInt16LE(32, 6); // bits por pixel
    entrada.writeUInt32LE(dados.length, 8);
    entrada.writeUInt32LE(deslocamento, 12);
    entradas.push(entrada);
    deslocamento += dados.length;
  }

  return Buffer.concat([cabecalho, ...entradas, ...pngs.map((p) => p.dados)]);
}

const pngs = [];
for (const tamanho of TAMANHOS) {
  const dados = await sharp(Buffer.from(SVG), {
    density: 72 * (tamanho / 48) * 4,
  })
    .resize(tamanho, tamanho)
    .png()
    .toBuffer();
  pngs.push({ tamanho, dados });
}

const destino = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "favicon.ico",
);
const ico = montarIco(pngs);
writeFileSync(destino, ico);
console.log(`favicon.ico: ${TAMANHOS.join(", ")} px, ${ico.length} bytes`);
