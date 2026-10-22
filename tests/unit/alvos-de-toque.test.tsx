/**
 * Alvos de toque de 44 px (#481).
 *
 * O botão pequeno do app tinha 36 px, e o de ícone 40, em 90 lugares. Em
 * aparelho de toque eles passam a ter 44 px pela variante `pointer-coarse`,
 * e o desktop mantém a densidade. O CSS não roda no jsdom, então aqui se
 * confere o que o garante, no componente que cobre todos os usos; a medida
 * de verdade, tela por tela, está em `tests/e2e/alvos-de-toque.spec.ts`.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackLink } from "@/components/layout/page-shell";
import { AlternarTema } from "@/components/theme-toggle";
import { Button, ButtonLink } from "@/components/ui/button";

describe("Button", () => {
  it("o pequeno sobe para 44 px em aparelho de toque, e fica em 36 px no mouse", () => {
    render(<Button size="sm">Sair</Button>);
    const { className } = screen.getByRole("button", { name: "Sair" });

    expect(className).toContain("h-9");
    expect(className).toContain("pointer-coarse:h-11");
  });

  it("o de ícone também", () => {
    render(
      <Button size="icon" aria-label="Fechar">
        x
      </Button>,
    );
    const { className } = screen.getByRole("button", { name: "Fechar" });

    expect(className).toContain("pointer-coarse:h-11");
    expect(className).toContain("pointer-coarse:w-11");
  });

  it("o link com cara de botão pequeno segue a mesma regra", () => {
    render(
      <ButtonLink href="/x" size="sm">
        Editar perfil
      </ButtonLink>,
    );

    expect(
      screen.getByRole("link", { name: "Editar perfil" }).className,
    ).toContain("pointer-coarse:h-11");
  });

  it("o médio e o grande já passam de 44 px e não ganham nada", () => {
    render(
      <>
        <Button size="md">Médio</Button>
        <Button size="lg">Grande</Button>
      </>,
    );

    for (const nome of ["Médio", "Grande"]) {
      expect(
        screen.getByRole("button", { name: nome }).className,
      ).not.toContain("pointer-coarse");
    }
    expect(screen.getByRole("button", { name: "Médio" }).className).toContain(
      "h-11",
    );
  });
});

describe("outros alvos que eram pequenos", () => {
  it("o botão de tema tem 44 px", () => {
    render(<AlternarTema />);

    const { className } = screen.getByRole("button", { name: /tema/i });
    expect(className).toContain("h-11");
    expect(className).toContain("w-11");
  });

  it("o 'Voltar' cresce a área de toque sem mexer no layout (padding e margem se compensam)", () => {
    render(<BackLink href="/vagas" label="Voltar para vagas" />);
    const { className } = screen.getByRole("link", {
      name: /Voltar para vagas/,
    });

    // 12 px de padding em cima e embaixo, devolvidos pela margem: o texto
    // fica onde estava e a área de toque passa de 20 para 44 px.
    expect(className).toContain("py-3");
    expect(className).toContain("-mt-3");
    expect(className).toContain("mb-1");
  });
});
