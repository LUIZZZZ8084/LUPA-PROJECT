/**
 * A cor da estrela tem 3:1 sobre os fundos, nos dois temas (#481).
 *
 * No tema claro a estrela era `#8a5a06`, o mesmo marrom do texto de aviso,
 * porque o token seguia a régua de 4,5:1 do texto. Mas a estrela é gráfico: o
 * WCAG 2.2 (1.4.11) pede 3:1 para gráfico, e a nota ficava marrom. No escuro ela
 * já era dourada (`#f5b544`). Agora o claro usa `#b87700`.
 *
 * O que se cobra aqui é o piso, e não a cor: qualquer dourado serve desde que
 * passe de 3:1 sobre `bg`, `panel`, `panel-2` e `panel-3` do tema, que são os
 * fundos onde a estrela aparece.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Luminância relativa (WCAG 2.x) de uma cor `#rrggbb`. */
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** O valor de um token dentro de um bloco do CSS, ou lança se faltar. */
function token(bloco: string, nome: string): string {
  const achou = bloco.match(new RegExp(`${nome}:\\s*(#[0-9a-fA-F]{6})`));
  if (!achou) throw new Error(`${nome} não encontrado`);
  return achou[1];
}

/** O bloco `@theme { ... }` do tema claro, e o do escuro. */
const claro = css.slice(
  css.indexOf("@theme {"),
  css.indexOf("@theme {") + 9000,
);
const escuro = css.slice(
  css.search(/\[data-theme="dark"\]\s*\{\s*(?:\/\*[\s\S]*?\*\/\s*)?--color-bg/),
);

const FUNDOS = [
  "--color-bg",
  "--color-panel",
  "--color-panel-2",
  "--color-panel-3",
];

describe("cor da estrela", () => {
  for (const [tema, bloco] of [
    ["claro", claro],
    ["escuro", escuro],
  ] as const) {
    describe(`tema ${tema}`, () => {
      const estrela = token(bloco, "--color-star");

      for (const fundo of FUNDOS) {
        it(`passa de 3:1 sobre ${fundo}`, () => {
          const razao = contraste(estrela, token(bloco, fundo));

          expect(
            razao,
            `${estrela} sobre ${token(bloco, fundo)}`,
          ).toBeGreaterThanOrEqual(3);
        });
      }
    });
  }

  it("no claro a estrela deixou de ser o marrom do texto de aviso", () => {
    expect(token(claro, "--color-star")).not.toBe(token(claro, "--color-warn"));
  });
});
