/**
 * O botão de WhatsApp passa no contraste nos dois temas (#546).
 *
 * A varredura de acessibilidade das rotas não alcança este botão: em
 * demonstração ele sai desativado, porque o contato é fictício, e por isso
 * o 2,51:1 do tema claro só existia em produção. O teste lê as cores do
 * `globals.css` e o estilo do botão, e faz a conta — inclusive no hover, que
 * clareia o fundo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const BOTAO = readFileSync(
  join(process.cwd(), "src/components/ui/button.tsx"),
  "utf8",
);

/** A primeira definição é a do tema claro; a segunda, a do escuro. */
function valores(token: string): [string, string] {
  const achados = [
    ...CSS.matchAll(new RegExp(`--color-${token}:\\s*(#[0-9a-f]{6});`, "gi")),
  ].map((m) => m[1]);
  expect(achados.length, token).toBeGreaterThanOrEqual(2);
  return [achados[0], achados[1]];
}

const canais = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** `bg-whatsapp/90`: a cor a 90% sobre o fundo da página. */
function misturar(cor: string, fundo: string, alfa: number): string {
  const [c, f] = [canais(cor), canais(fundo)];
  return `#${c
    .map((v, i) =>
      Math.round(v * alfa + f[i] * (1 - alfa))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

describe("contraste do botão de WhatsApp", () => {
  it("o texto do botão é a cor do fundo da página", () => {
    expect(BOTAO).toMatch(
      /whatsapp:\s*"bg-whatsapp text-bg hover:bg-whatsapp\/90"/,
    );
  });

  it.each([
    ["claro", 0],
    ["escuro", 1],
  ] as const)("passa em 4,5:1 no tema %s, parado e no hover", (_tema, i) => {
    const whatsapp = valores("whatsapp")[i];
    const fundo = valores("bg")[i];

    expect(contraste(fundo, whatsapp)).toBeGreaterThanOrEqual(4.5);
    expect(
      contraste(fundo, misturar(whatsapp, fundo, 0.9)),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
