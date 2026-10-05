/**
 * A logo nova: lupa com pessoa, em degradê, e o nome em vetor (#343).
 *
 * O que se cobra é o que já deu errado ou o que ninguém notaria quebrar:
 * o cabo entrando na lente (foi o primeiro defeito apontado no desenho), o
 * *check* da logo antiga voltando a prometer "verificado", e o nome
 * voltando a depender de uma fonte que o app não carrega.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import { LupaLogo, LupaMark } from "@/components/brand/logo";
import { LOGO_HORIZONTAL, NOME, simbolo } from "@/components/brand/marca";

const CORES = { aro: "#111111", disco: "#222222", pessoa: "#333333" };

/** Propriedades de cada peça do símbolo, pela chave. */
function peca(chave: string) {
  const elemento = simbolo(CORES).find((e) => e.key === chave);
  expect(isValidElement(elemento), chave).toBe(true);
  return (elemento as React.ReactElement<Record<string, string>>).props;
}

describe("símbolo", () => {
  it("é lupa, disco e pessoa — e a pessoa leva a cor que veio", () => {
    expect(simbolo(CORES).map((e) => e.key)).toEqual([
      "aro",
      "cabo",
      "disco",
      "cabeca",
      "ombros",
    ]);
    expect(peca("aro").stroke).toBe(CORES.aro);
    expect(peca("cabo").stroke).toBe(CORES.aro);
    expect(peca("disco").fill).toBe(CORES.disco);
    expect(peca("cabeca").fill).toBe(CORES.pessoa);
    expect(peca("ombros").fill).toBe(CORES.pessoa);
  });

  /**
   * O defeito que o Luiz apontou: o cabo avançava para dentro da lente.
   *
   * A ponta é arredondada e passa meia espessura para trás de onde a linha
   * começa. Se o ponto inicial menos meia espessura chega mais perto do
   * centro que a borda de dentro do aro, a ponta aparece no vão entre o
   * aro e o disco.
   */
  it("a ponta do cabo não entra no vão de dentro da lente", () => {
    const aro = peca("aro");
    const cabo = peca("cabo");

    const centro = { x: Number(aro.cx), y: Number(aro.cy) };
    const bordaDeDentro = Number(aro.r) - Number(aro.strokeWidth) / 2;
    const inicio = Math.hypot(
      Number(cabo.x1) - centro.x,
      Number(cabo.y1) - centro.y,
    );
    const pontaDeTras = inicio - Number(cabo.strokeWidth) / 2;

    expect(pontaDeTras).toBeGreaterThanOrEqual(bordaDeDentro);
  });

  it("o cabo sai para baixo e para a esquerda", () => {
    const cabo = peca("cabo");
    expect(Number(cabo.x2)).toBeLessThan(Number(cabo.x1));
    expect(Number(cabo.y2)).toBeGreaterThan(Number(cabo.y1));
  });
});

describe("LupaMark", () => {
  it("o aro é um degradê que troca com o tema", () => {
    const { container } = render(<LupaMark />);
    const stops = container.querySelectorAll("linearGradient stop");

    expect(stops).toHaveLength(2);
    expect(stops[0]).toHaveStyle({ stopColor: "var(--logo-a)" });
    expect(stops[1]).toHaveStyle({ stopColor: "var(--logo-b)" });
    expect(container.querySelector("circle")?.getAttribute("stroke")).toMatch(
      /^url\(#.+\)$/,
    );
  });

  /** Duas marcas na mesma tela não podem dividir o mesmo degradê. */
  it("cada instância tem o próprio degradê", () => {
    const { container } = render(
      <>
        <LupaMark />
        <LupaMark />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map(
      (g) => g.id,
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("não traz o check da logo antiga, que prometia 'verificado'", () => {
    const { container } = render(<LupaMark />);
    expect(container.innerHTML).not.toContain("M15 21");
  });
});

describe("nome em vetor", () => {
  it("é um desenho nomeado, e não texto com fonte", () => {
    const { container } = render(<LupaLogo />);
    const nome = screen.getByRole("img", { name: "Lupa" });

    expect(nome.querySelector("path")?.getAttribute("d")).toBe(NOME.d);
    expect(container.querySelector("text")).toBeNull();
  });

  it("o quadro cobre as maiúsculas, com o p descendo para fora", () => {
    const nome = render(<LupaLogo />).container.querySelectorAll("svg")[1];
    expect(nome).toHaveAttribute("viewBox", NOME.viewBox);
    expect(nome).toHaveClass("overflow-visible");
  });

  it("a logo horizontal da imagem do link usa o mesmo desenho", () => {
    const fonte = readFileSync(
      join(process.cwd(), "src/app/opengraph-image.tsx"),
      "utf8",
    );
    expect(fonte).toContain("NOME.d");
    expect(fonte).toContain("LOGO_HORIZONTAL");
    expect(LOGO_HORIZONTAL.viewBox).toBe("0 0 180 64");
  });
});

describe("degradê no tema", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("tem as duas pontas nos dois temas", () => {
    expect(css).toMatch(/:root\s*\{[^}]*--logo-a:[^}]*--logo-b:/);
    expect(css).toMatch(
      /:root\[data-theme="dark"\]\s*\{[^}]*--logo-a:[^}]*--logo-b:/,
    );
  });
});
