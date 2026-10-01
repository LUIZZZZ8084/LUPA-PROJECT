/**
 * @vitest-environment node
 *
 * O ícone da aba é a logo da Lupa, não o triângulo do Next (#303).
 *
 * `src/app/favicon.ico` ficou o triângulo padrão do framework desde o
 * primeiro commit, enquanto `icon.tsx` e `apple-icon.tsx` já tinham a logo.
 * O navegador escolhe qual ícone usa, então quem recebia o `.ico` via o
 * triângulo na aba — e nada quebrava, nenhum teste olhava o arquivo.
 *
 * Os testes leem o próprio `.ico`: decodificam a imagem de verdade, porque
 * conferir só o tamanho do arquivo passaria com qualquer figura.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const ICO = readFileSync(join(RAIZ, "src/app/favicon.ico"));

/** As imagens do contêiner ICO: tamanho declarado e os bytes do PNG. */
function imagensDoIco(arquivo: Buffer) {
  expect(arquivo.readUInt16LE(0), "reservado").toBe(0);
  expect(arquivo.readUInt16LE(2), "tipo: 1 = ícone").toBe(1);
  const quantas = arquivo.readUInt16LE(4);
  return Array.from({ length: quantas }, (_, i) => {
    const base = 6 + i * 16;
    const largura = arquivo.readUInt8(base) || 256;
    const tamanho = arquivo.readUInt32LE(base + 8);
    const inicio = arquivo.readUInt32LE(base + 12);
    return { largura, dados: arquivo.subarray(inicio, inicio + tamanho) };
  });
}

describe("favicon.ico", () => {
  const imagens = imagensDoIco(ICO);

  it("traz 16, 32 e 48 px", () => {
    expect(imagens.map((i) => i.largura)).toEqual([16, 32, 48]);
  });

  it("cada imagem decodifica e tem o tamanho que declara", async () => {
    for (const { largura, dados } of imagens) {
      const meta = await sharp(dados).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(largura);
      expect(meta.height).toBe(largura);
    }
  });

  /**
   * O triângulo do Next é preto e branco. A logo da Lupa tem o verde da
   * marca (`#a8d94a`), e é ele que o teste procura nos pixels.
   */
  it("é a logo da Lupa: tem o verde da marca, e não só preto e branco", async () => {
    const maior = imagens.at(-1);
    expect(maior).toBeDefined();
    const { data, info } = await sharp(maior?.dados)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let verdes = 0;
    let escuros = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a > 200 && g > 190 && r > 130 && r < 200 && b < 110) verdes++;
      if (a > 200 && r < 40 && g < 40 && b < 50) escuros++;
    }

    // Controle: o triângulo do Next não tem nenhum pixel desta cor.
    expect(verdes, "pixels verdes da marca").toBeGreaterThan(100);
    expect(escuros, "pixels do fundo escuro").toBeGreaterThan(300);
  });

  it("não é o arquivo de fábrica do Next (25.931 bytes)", () => {
    expect(ICO.length).not.toBe(25931);
    expect(ICO.length).toBeLessThan(15_000);
  });
});

describe("o favicon e o icon.tsx saem do mesmo desenho", () => {
  const script = readFileSync(join(RAIZ, "scripts/gerar-favicon.mjs"), "utf8");
  const icon = readFileSync(join(RAIZ, "src/app/icon.tsx"), "utf8");

  /**
   * `ImageResponse` não lê o `@theme`, então as cores moram em dois lugares
   * e a troca de paleta esquece um deles — o aviso já está em `icon.tsx`.
   * Este teste é o que cobra o outro.
   */
  it.each(["FUNDO", "VERDE", "BRANCO"])(
    "a cor %s do script é a do icon.tsx",
    (nome) => {
      const hex = new RegExp(`const ${nome} = "(#[0-9a-f]{6})"`, "i").exec(
        script,
      )?.[1];
      expect(hex, `const ${nome} no script`).toBeDefined();
      expect(icon.toLowerCase()).toContain((hex ?? "").toLowerCase());
    },
  );
});
