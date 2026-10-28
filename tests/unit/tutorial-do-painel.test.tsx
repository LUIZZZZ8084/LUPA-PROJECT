/**
 * O tutorial de primeira visita do painel de contratação (#513).
 *
 * Os cards de atalho saíram do painel e o que eles explicavam virou um
 * tutorial curto, um passo por vez, que aparece uma vez por aparelho. O que
 * se prova aqui: anda passo a passo, "Pular", o X e o último passo fecham, e
 * fechado não volta — nem depois de montar de novo.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PASSOS = [
  { titulo: "Publique uma vaga", texto: "Pelo botão de publicar." },
  { titulo: "Acompanhe no Funil", texto: "Cada currículo vira um card." },
  { titulo: "Chame de novo", texto: "A aba Talentos reúne todo mundo." },
];

/*
 * O "fechado nesta visita" mora no módulo: cada teste importa uma cópia
 * nova, como uma visita nova ao app.
 */
async function montar(passos = PASSOS) {
  vi.resetModules();
  const { TutorialDoPainel, CHAVE_DO_TUTORIAL } = await import(
    "@/app/(app)/_contratacao/tutorial"
  );
  render(<TutorialDoPainel passos={passos} />);
  return CHAVE_DO_TUTORIAL;
}

const botao = (nome: string | RegExp) =>
  screen.getByRole("button", { name: nome });

describe("tutorial do painel", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("aparece na primeira visita, no primeiro passo", async () => {
    await montar();

    expect(
      screen.getByRole("heading", { name: "Publique uma vaga" }),
    ).toBeTruthy();
    expect(screen.getByText(/1 de 3/)).toBeTruthy();
  });

  it("anda um passo por vez e fecha no último", async () => {
    const chave = await montar();

    fireEvent.click(botao("Próximo"));
    expect(
      screen.getByRole("heading", { name: "Acompanhe no Funil" }),
    ).toBeTruthy();
    expect(screen.getByText(/2 de 3/)).toBeTruthy();

    fireEvent.click(botao("Próximo"));
    expect(screen.getByRole("heading", { name: "Chame de novo" })).toBeTruthy();
    // No último não há "Próximo" nem "Pular": só fechar.
    expect(screen.queryByRole("button", { name: "Próximo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pular" })).toBeNull();

    act(() => fireEvent.click(botao("Entendi")));
    expect(screen.queryByRole("heading", { name: "Chame de novo" })).toBeNull();
    expect(localStorage.getItem(chave)).not.toBeNull();
  });

  it.each([
    ["Pular", "Pular"],
    ["o X", /Fechar o tutorial/],
  ])("%s fecha, e não volta na próxima visita", async (_, nome) => {
    await montar();

    act(() => fireEvent.click(botao(nome)));
    expect(screen.queryByText(/Como funciona o painel/)).toBeNull();

    cleanup();
    await montar();
    expect(screen.queryByText(/Como funciona o painel/)).toBeNull();
  });

  /** Aba anônima estrita: o storage recusa, e fechar ainda fecha. */
  it("fecha mesmo quando o aparelho não guarda nada", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    try {
      await montar();
      act(() => fireEvent.click(botao("Pular")));
      expect(screen.queryByText(/Como funciona o painel/)).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it("sem passo nenhum, não desenha nada", async () => {
    await montar([]);
    expect(screen.queryByText(/Como funciona o painel/)).toBeNull();
  });
});
