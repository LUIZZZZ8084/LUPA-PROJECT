/**
 * Os títulos equilibram as linhas (#483).
 *
 * Um título que quebra em três linhas deixava uma palavra sozinha: no celular,
 * "Encontre seu / próximo / trabalho". `text-wrap: balance` distribui as
 * palavras para as linhas ficarem parecidas, sem acrescentar linha nenhuma. O
 * CSS não roda no jsdom, então aqui se confere a regra; o estilo calculado no
 * navegador está em `tests/e2e/banner-sem-texto-sobre-o-homem.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("títulos equilibrados", () => {
  it("h1, h2 e h3 têm text-wrap: balance", () => {
    const regra = css.match(/h1,\s*h2,\s*h3\s*\{([^}]*)\}/);

    expect(regra?.[1]).toMatch(/text-wrap:\s*balance;/);
  });

  it("os parágrafos ficam de fora: balance neles não se vê e custa reflow", () => {
    expect(css).not.toMatch(/\bp\s*\{[^}]*text-wrap/);
  });
});
