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
 * O desenho é o mesmo do `icon.tsx` (a logo de `src/components/brand`), e
 * as cores também: `ImageResponse` não lê o `@theme`, então elas moram em
 * três lugares, e há teste (`tests/unit/favicon.test.ts`) que cobra que
 * este arquivo, o `icon.tsx` e o `apple-icon.tsx` não se separem. A
 * geometria está repetida aqui porque este script roda em Node puro e não
 * importa TSX.
 *
 * O `.ico` leva um PNG por tamanho (16, 32 e 48 px), formato que todo
 * navegador atual lê. Sem dependência nova: o `sharp` já é do projeto.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const FUNDO_DE = "#8cc63f";
export const FUNDO_ATE = "#2f5a0b";
export const ARO = "#ffffff";
export const DISCO = "#1f3f08";
export const PESSOA = "#ffffff";

const TAMANHOS = [16, 32, 48];

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="fundo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0" stop-color="${FUNDO_DE}"/>
      <stop offset="1" stop-color="${FUNDO_ATE}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#fundo)"/>
  <g transform="translate(4.9 4.1) scale(0.86)">
    <circle cx="36" cy="28" r="18" stroke="${ARO}" stroke-width="8"/>
    <line x1="22.56" y1="41.44" x2="9.5" y2="54.5" stroke="${ARO}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="36" cy="28" r="11.5" fill="${DISCO}"/>
    <circle cx="36" cy="23.6" r="3.9" fill="${PESSOA}"/>
    <path d="M28.6 35.5c0-3.8 3.2-6.2 7.4-6.2s7.4 2.4 7.4 6.2Z" fill="${PESSOA}"/>
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
    density: 72 * (tamanho / 64) * 4,
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
