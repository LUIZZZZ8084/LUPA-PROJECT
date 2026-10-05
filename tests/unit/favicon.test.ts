/**
 * @vitest-environment node
 *
 * O ícone da aba é a logo da Lupa (#303).
 *
 * `src/app/favicon.ico` era o arquivo de fábrica do Next desde o primeiro
 * commit, e a aba mostrava o triângulo dele. Nada quebrava, e nenhum teste
 * olhava o arquivo. Este lê o próprio `.ico`, decodifica as imagens e
 * procura o verde da marca — o triângulo é preto e branco.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const ICO = readFileSync(join(process.cwd(), "src/app/favicon.ico"));
const SCRIPT = readFileSync(
  join(process.cwd(), "scripts/gerar-favicon.mjs"),
  "utf8",
);

function imagens() {
  const total = ICO.readUInt16LE(4);
  return Array.from({ length: total }, (_, i) => {
    const entrada = 6 + 16 * i;
    const tamanho = ICO.readUInt32LE(entrada + 8);
    const inicio = ICO.readUInt32LE(entrada + 12);
    return {
      lado: ICO[entrada] || 256,
      dados: ICO.subarray(inicio, inicio + tamanho),
    };
  });
}

/** Cor declarada no script, pelo nome da constante. */
function corDoScript(nome: string) {
  return SCRIPT.match(new RegExp(`${nome} = "(#[0-9a-f]{6})"`))?.[1];
}

describe("ícone da aba", () => {
  it("é um ícone, com 16, 32 e 48 px", () => {
    expect(ICO.readUInt16LE(2)).toBe(1);
    expect(imagens().map((i) => i.lado)).toEqual([16, 32, 48]);
  });

  it.each([16, 32, 48])(
    "a imagem de %d px tem o verde da logo",
    async (lado) => {
      const imagem = imagens().find((i) => i.lado === lado);
      const { data, info } = await sharp(imagem?.dados)
        .raw()
        .toBuffer({ resolveWithObject: true });

      expect(info.width).toBe(lado);
      let verdes = 0;
      for (let p = 0; p < data.length; p += info.channels) {
        const [r, g, b] = [data[p], data[p + 1], data[p + 2]];
        if (g > 150 && g > r + 20 && g > b + 60) verdes++;
      }
      expect(verdes).toBeGreaterThan(0);
    },
  );

  /**
   * `ImageResponse` não lê o `@theme`, então as cores moram no script, no
   * `icon.tsx` e no `apple-icon.tsx`. Trocar a paleta num só deixaria a
   * aba com uma logo e o ícone instalado com outra.
   */
  it.each(["icon.tsx", "apple-icon.tsx"])(
    "as cores do script são as do %s",
    (arquivo) => {
      const fonte = readFileSync(
        join(process.cwd(), "src/app", arquivo),
        "utf8",
      );
      for (const nome of ["FUNDO", "LENTE", "VISTO"]) {
        const cor = corDoScript(nome);
        expect(cor, nome).toBeDefined();
        expect(fonte, `${nome} ${cor}`).toContain(`"${cor}"`);
      }
    },
  );
});
