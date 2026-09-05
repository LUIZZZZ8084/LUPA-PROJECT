/**
 * O interruptor de tema — Issue #146.
 *
 * `AlternarTema` deixou de guardar o próprio estado (`useState` +
 * `useEffect` chamando `setEscuro` no corpo do efeito) e passou a ler
 * `data-theme` via `useSyncExternalStore`, porque a regra
 * `react-hooks/set-state-in-effect` reprovava o padrão antigo — legítimo
 * (o componente roda no servidor sem `document`), mas ainda assim um
 * `setState` síncrono dentro de um efeito.
 *
 * O que se cobra aqui é que a reescrita manteve o comportamento: o botão
 * reflete o atributo real do `<html>`, alterna os dois, grava a escolha,
 * e duas instâncias do componente ficam sincronizadas — a parte que só um
 * teste pega, porque a notificação entre instâncias não aparece navegando
 * numa tela só.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AlternarTema } from "@/components/theme-toggle";
import { CHAVE_TEMA } from "@/lib/theme";

function estaEscuro(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("AlternarTema", () => {
  it("começa refletindo o atributo já presente no <html>", () => {
    render(<AlternarTema />);
    expect(
      screen.getByRole("button", { name: "Mudar para o tema escuro" }),
    ).toBeInTheDocument();
  });

  it("com data-theme='dark' já no DOM, nasce mostrando o botão de voltar ao claro", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<AlternarTema />);
    expect(
      screen.getByRole("button", { name: "Mudar para o tema claro" }),
    ).toBeInTheDocument();
  });

  it("clicar liga o atributo, grava a escolha e troca o rótulo", async () => {
    render(<AlternarTema />);
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /tema escuro/i }));

    expect(estaEscuro()).toBe(true);
    expect(localStorage.getItem(CHAVE_TEMA)).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Mudar para o tema claro" }),
    ).toBeInTheDocument();
  });

  it("clicar duas vezes volta ao claro, e o atributo some do <html>", async () => {
    render(<AlternarTema />);
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    const botao = () => screen.getByRole("button", { name: /tema/i });
    await user.click(botao());
    await user.click(botao());

    expect(estaEscuro()).toBe(false);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(CHAVE_TEMA)).toBe("light");
    expect(
      screen.getByRole("button", { name: "Mudar para o tema escuro" }),
    ).toBeInTheDocument();
  });

  /**
   * O app monta o interruptor em dois layouts diferentes — `(auth)` e o
   * cabeçalho de `(app)` —, nunca os dois ao mesmo tempo hoje. Mas a
   * escuta é um `Set` de módulo, compartilhado entre toda instância viva;
   * se ela não notificar as outras, uma migração futura para mostrar dois
   * interruptores na mesma tela regride em silêncio, e clicar um deles
   * deixaria o outro mentindo sobre o tema atual.
   */
  it("duas instâncias montadas ao mesmo tempo ficam sincronizadas", async () => {
    render(
      <>
        <AlternarTema />
        <AlternarTema />
      </>,
    );
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    const [primeiro, segundo] = screen.getAllByRole("button", {
      name: /tema/i,
    });

    await user.click(primeiro);

    expect(estaEscuro()).toBe(true);
    for (const botao of [primeiro, segundo]) {
      expect(botao).toHaveAttribute("aria-label", "Mudar para o tema claro");
    }
  });
});
