/**
 * O cadastro só pede acordo com o que existe para ler.
 *
 * A frase "você concorda com os termos de uso" aparecia sempre — inclusive
 * com `/termos` respondendo 404, porque o controlador ainda não está
 * identificado. Consentimento a documento que a pessoa não consegue abrir
 * não vale, e a tela afirmava um acordo que não podia existir.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const controlador = vi.hoisted(() => ({ PRONTO_PARA_PUBLICAR: false }));
vi.mock("@/lib/controlador", () => controlador);

const { ConsentimentoDoCadastro } = await import(
  "@/app/(auth)/cadastro/consentimento"
);

describe("consentimento do cadastro", () => {
  it("sem termos publicados, não pede acordo com termos", () => {
    controlador.PRONTO_PARA_PUBLICAR = false;
    const { container } = render(<ConsentimentoDoCadastro />);

    expect(container.textContent).not.toMatch(/concorda/i);
    expect(container.textContent).not.toMatch(/termos de uso/i);
    // O que é verdade com ou sem termos continua lá.
    expect(container.textContent).toMatch(/CPF fica guardado/);
  });

  it("com termos publicados, pede o acordo e aponta para os dois textos", () => {
    controlador.PRONTO_PARA_PUBLICAR = true;
    render(<ConsentimentoDoCadastro />);

    expect(
      screen.getByRole("link", { name: /termos de uso/i }).getAttribute("href"),
    ).toBe("/termos");
    expect(
      screen
        .getByRole("link", { name: /política de privacidade/i })
        .getAttribute("href"),
    ).toBe("/privacidade");
  });
});
