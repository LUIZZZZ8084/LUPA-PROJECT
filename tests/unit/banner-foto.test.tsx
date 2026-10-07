/**
 * @vitest-environment node
 *
 * A foto do banner não tem vão entre os braços (#382).
 *
 * O recorte do homem tinha um buraco transparente de uns 20 × 10 px no pé da
 * imagem, entre os antebraços, aberto para a borda de baixo. A foto fica
 * encostada embaixo no banner, então o que está atrás (a faixa, o fundo do
 * tema) aparecia por ali, e a cor mudava com o tema. Ninguém vê isso num
 * teste de renderização: o defeito está nos pixels do arquivo, então estes
 * testes decodificam o WebP de verdade.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BannerDaHome } from "@/components/banner-da-home";

/** Quantas linhas, a partir da borda de baixo, precisam estar inteiras. */
const LINHAS_DO_PE = 16;

/** Acima disto, o pixel conta como foto; abaixo, como transparente. */
const OPACO = 128;

/**
 * Em cada linha de baixo, quantos pixels transparentes há entre o primeiro e
 * o último opaco. Zero é uma faixa contínua; o vão entre os braços dava 27.
 * A silhueta nas pontas (o contorno do braço) não conta: só o que fica
 * *entre* pedaços de foto.
 */
function vaosNoPe(alfa: Uint8Array, largura: number, altura: number) {
  const vaos: number[] = [];
  for (let y = altura - LINHAS_DO_PE; y < altura; y++) {
    const linha = alfa.subarray(y * largura, (y + 1) * largura);
    const primeiro = linha.findIndex((a) => a >= OPACO);
    const ultimo = linha.findLastIndex((a) => a >= OPACO);
    let abertos = 0;
    for (let x = primeiro; x < ultimo; x++) {
      if (linha[x] < OPACO) abertos++;
    }
    vaos.push(abertos);
  }
  return vaos;
}

/** Só o canal alfa de uma imagem, uma linha depois da outra. */
async function alfaDe(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alfa = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alfa.length; i++) alfa[i] = data[i * info.channels + 3];
  return { alfa, largura: info.width, altura: info.height };
}

/** O endereço que o componente usa, dentro de `public/`. */
function arquivoDaFoto() {
  const html = renderToStaticMarkup(<BannerDaHome />);
  const img = /<img[^>]*>/.exec(html)?.[0] ?? "";
  const src = /src="([^"]+)"/.exec(img)?.[1] ?? "";
  // `next/image` manda o endereço dentro de `?url=`, ou deixa-o direto.
  const url = new URL(src.replaceAll("&amp;", "&"), "http://x");
  const rota = url.searchParams.get("url") ?? url.pathname;
  const largura = Number(/width="(\d+)"/.exec(img)?.[1]);
  const altura = Number(/height="(\d+)"/.exec(img)?.[1]);
  return {
    caminho: path.join(process.cwd(), "public", rota),
    largura,
    altura,
  };
}

describe("foto do banner da home", () => {
  it("o pé da foto é uma faixa contínua, sem vão entre os braços", async () => {
    const { caminho } = arquivoDaFoto();
    const { alfa, largura, altura } = await alfaDe(await readFile(caminho));

    expect(vaosNoPe(alfa, largura, altura)).toEqual(
      new Array(LINHAS_DO_PE).fill(0),
    );
  });

  /**
   * Prova de que a conferência de cima pega o defeito: uma foto de 10 × 4 com
   * um vão de dois pixels na última linha, aberto para a borda, como era o do
   * banner. Sem isto, um teste que sempre passa seria indistinguível de um
   * que vigia.
   */
  it("a conferência acusa um vão aberto para a borda de baixo", () => {
    const largura = 10;
    const altura = LINHAS_DO_PE; // só o pé importa
    const alfa = new Uint8Array(largura * altura).fill(255);
    for (const x of [4, 5]) alfa[(altura - 1) * largura + x] = 0;

    const vaos = vaosNoPe(alfa, largura, altura);
    expect(vaos.at(-1)).toBe(2);
    expect(vaos.slice(0, -1).every((v) => v === 0)).toBe(true);
  });

  it("a silhueta nas pontas não é tomada por vão", () => {
    const largura = 10;
    const altura = LINHAS_DO_PE;
    const alfa = new Uint8Array(largura * altura);
    // Uma faixa opaca de 2 a 7, com transparente dos dois lados.
    for (let y = 0; y < altura; y++)
      alfa.fill(255, y * largura + 2, y * largura + 8);

    expect(vaosNoPe(alfa, largura, altura).every((v) => v === 0)).toBe(true);
  });

  /**
   * `next/image` reserva o espaço pelas medidas declaradas. Se elas não forem
   * as do arquivo, a foto sai esticada ou deixa uma sobra, e trocar a imagem
   * sem trocar os números passaria despercebido.
   */
  it("as medidas declaradas no componente são as do arquivo", async () => {
    const { caminho, largura, altura } = arquivoDaFoto();
    const meta = await sharp(await readFile(caminho)).metadata();

    expect({ largura, altura }).toEqual({
      largura: meta.width,
      altura: meta.height,
    });
  });
});
