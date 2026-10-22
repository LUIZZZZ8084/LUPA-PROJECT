/**
 * A regra global de foco e o destino do "Pular para o conteúdo" (#479).
 *
 * O CSS não roda no jsdom, então o que se cobra aqui é o texto da regra, que
 * é onde o defeito morava: um `border-radius` dentro do `:focus-visible`
 * global, fora de qualquer camada, vencia todos os utilitários de raio. O
 * comportamento de verdade, medido no navegador, está em
 * `tests/e2e/foco-sem-deformar.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ID_DO_CONTEUDO, PageShell } from "@/components/layout/page-shell";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** O bloco `{ ... }` da regra cujo seletor contém `focus-visible` global. */
function regraDeFoco() {
  const achou = css.match(/:where\([^{]*\):focus-visible\s*\{([^}]*)\}/);
  if (!achou) throw new Error("regra global de foco não encontrada");
  return { seletor: achou[0].split("{")[0], corpo: achou[1] };
}

describe("regra global de foco", () => {
  it("desenha o anel com outline e não mexe no raio da borda", () => {
    const { corpo } = regraDeFoco();

    expect(corpo).toContain("outline: 2px solid");
    expect(corpo).not.toMatch(/border-radius/);
  });

  it("deixa de fora o que só recebe foco por código (tabindex=-1)", () => {
    const { seletor } = regraDeFoco();

    expect(seletor).toContain('[tabindex]:not([tabindex="-1"])');
  });

  it("e apaga o anel que o navegador desenharia nesse alvo", () => {
    expect(css).toMatch(/\[tabindex="-1"\]:focus\s*\{\s*outline:\s*none;/);
  });
});

describe("destino do 'Pular para o conteúdo'", () => {
  it("o <main> tem o id do link e recebe foco por código, fora da ordem de Tab", () => {
    const { container } = render(<PageShell>x</PageShell>);
    const main = container.querySelector("main");

    expect(main).toHaveAttribute("id", ID_DO_CONTEUDO);
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("o id é um valor só, usado pelo link e pelo <main>", () => {
    expect(ID_DO_CONTEUDO).toBe("conteudo");
  });
});
