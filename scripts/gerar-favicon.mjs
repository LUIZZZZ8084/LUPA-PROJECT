#!/usr/bin/env node
/**
 * Gera `src/app/favicon.ico` a partir do desenho da logo.
 *
 *   node scripts/gerar-favicon.mjs
 *
 * POR QUE ISTO EXISTE (#303)
 * ──────────────────────────
 * O `favicon.ico` do repositório era o triângulo preto que o Next traz de
 * fábrica, desde o primeiro commit. A logo da Lupa já existia — `icon.tsx`
 * gera o PNG de 512 px e `apple-icon.tsx` o do iPhone —, e o HTML declara os
 * dois. Mas o navegador escolhe qual usar, e quem escolhia o `.ico` mostrava
 * o triângulo na aba. O PNG certo ao lado de um `.ico` errado é o pior caso:
 * parece resolvido e depende do navegador.
 *
 * O arquivo é gerado, e não desenhado à mão, para sair do mesmo desenho que
 * os outros dois ícones. O contêiner ICO é escrito aqui mesmo, com um PNG
 * por tamanho: todo navegador atual lê PNG dentro de ICO, e não precisa de
 * dependência nova — o `sharp` já é do projeto (#283).
 *
 * Os hexadecimais vêm de `src/app/icon.tsx`, que por sua vez os copia de
 * `--color-vagas` e do fundo escuro do tema: `ImageResponse` não lê o
 * `@theme`. Trocou a paleta, troque aqui também.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const FUNDO = "#0b0f14";
const VERDE = "#a8d94a";
const BRANCO = "#f2f5f8";

/**
 * A mesma lupa de `icon.tsx`, com um enquadramento mais justo.
 *
 * O ícone de 512 px deixa a lupa em 70% do quadro porque ali sobra espaço.
 * Numa aba de 16 px cada pixel conta: a lupa ocupa o quadro quase todo, com
 * a margem de 4 unidades que o desenho original já tem (o traço vai de 5 a
 * 45 numa grade de 48, e o `translate` recentra isso).
 */
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="10" fill="${FUNDO}"/>
  <g transform="translate(-1 -1)" fill="none">
    <circle cx="21" cy="21" r="14" stroke="${VERDE}" stroke-width="4"/>
    <line x1="31" y1="31" x2="43" y2="43" stroke="${VERDE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M15 21 L19 25 L28 15" stroke="${BRANCO}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const TAMANHOS = [16, 32, 48];

async function png(tamanho) {
  // `density` alto para o SVG ser rasterizado nítido e só depois reduzido.
  return sharp(Buffer.from(SVG), { density: 384 })
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICONDIR (6 bytes) + um ICONDIRENTRY (16 bytes) por imagem + os PNGs. */
function montarIco(imagens) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo: ícone
  cabecalho.writeUInt16LE(imagens.length, 4);

  let deslocamento = 6 + 16 * imagens.length;
  const entradas = imagens.map(({ tamanho, dados }) => {
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(tamanho, 0); // largura (0 significaria 256)
    entrada.writeUInt8(tamanho, 1); // altura
    entrada.writeUInt8(0, 2); // cores na paleta: 0 = sem paleta
    entrada.writeUInt8(0, 3); // reservado
    entrada.writeUInt16LE(1, 4); // planos
    entrada.writeUInt16LE(32, 6); // bits por pixel
    entrada.writeUInt32LE(dados.length, 8);
    entrada.writeUInt32LE(deslocamento, 12);
    deslocamento += dados.length;
    return entrada;
  });

  return Buffer.concat([
    cabecalho,
    ...entradas,
    ...imagens.map((i) => i.dados),
  ]);
}

const imagens = [];
for (const tamanho of TAMANHOS) {
  imagens.push({ tamanho, dados: await png(tamanho) });
}

const destino = fileURLToPath(
  new URL("../src/app/favicon.ico", import.meta.url),
);
const ico = montarIco(imagens);
writeFileSync(destino, ico);

console.log(
  `favicon.ico: ${TAMANHOS.join(", ")} px, ${ico.length} bytes → src/app/favicon.ico`,
);
