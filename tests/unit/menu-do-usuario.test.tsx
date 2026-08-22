/**
 * Quem já entrou não pode ver "Entrar" no topo: o botão sugere que a sessão
 * não pegou, e a pessoa clica achando que precisa entrar de novo. No lugar
 * dele fica a foto, com o menu da conta atrás — o padrão que o Luiz apontou
 * no LinkedIn.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const sair = vi.hoisted(() => vi.fn(async () => ({ ok: true }) as const));
vi.mock("@/app/conta/actions", () => ({ sairDaConta: sair }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { MenuDoUsuario } = await import("@/components/layout/menu-do-usuario");

const CANDIDATO = {
  nome: "Ana Paula Ribeiro",
  papel: "candidato_clt",
  avatarUrl: null,
};

function abrir(usuario = CANDIDATO) {
  render(<MenuDoUsuario usuario={usuario} />);
  fireEvent.click(screen.getByRole("button", { name: /conta de/i }));
}

describe("menu da conta", () => {
  it("começa fechado", () => {
    render(<MenuDoUsuario usuario={CANDIDATO} />);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  /** O avatar sozinho não dá nome ao botão para quem usa leitor de tela. */
  it("o botão tem nome acessível mesmo sem texto visível", () => {
    render(<MenuDoUsuario usuario={CANDIDATO} />);
    const botao = screen.getByRole("button", { name: /Conta de Ana Paula/i });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveAttribute("aria-haspopup", "menu");
  });

  it("abre no clique e anuncia que abriu", () => {
    abrir();
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("button", { name: /conta de/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("mostra nome e papel de quem está logado", () => {
    abrir();
    expect(screen.getByText("Ana Paula Ribeiro")).toBeTruthy();
  });

  it("leva ao perfil", () => {
    abrir();
    expect(
      screen.getByRole("menuitem", { name: /ver perfil/i }),
    ).toHaveAttribute("href", "/perfil");
  });

  it("fecha no Escape", () => {
    abrir();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("sai da conta", () => {
    abrir();
    fireEvent.click(screen.getByRole("menuitem", { name: /sair da conta/i }));
    expect(sair).toHaveBeenCalled();
  });
});

/**
 * Atalho que leva a 404 é pior do que atalho ausente: a pessoa conclui que
 * o app está quebrado, não que a função ainda não existe.
 */
describe("atalhos por papel", () => {
  it("empresa vê o painel da empresa", () => {
    abrir({ ...CANDIDATO, papel: "empresa" });
    expect(
      screen.getByRole("menuitem", { name: /painel da empresa/i }),
    ).toHaveAttribute("href", "/empresa");
  });

  it("admin vê o painel do admin", () => {
    abrir({ ...CANDIDATO, papel: "admin" });
    expect(
      screen.getByRole("menuitem", { name: /painel do admin/i }),
    ).toHaveAttribute("href", "/admin/painel");
  });

  it("candidato não vê painel nenhum", () => {
    abrir();
    expect(screen.queryByRole("menuitem", { name: /painel/i })).toBeNull();
  });
});
