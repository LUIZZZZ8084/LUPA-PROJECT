/**
 * O convite para instalar, renderizado (#475).
 *
 * O componente guarda estado no módulo — "Agora não" vale para a visita
 * inteira —, então cada teste importa uma cópia nova dele, que é o que
 * abrir a Lupa de novo faz.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTO_INSTALAVEL, type PedidoDeInstalacao } from "@/lib/instalacao";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

function definir(nome: string, valor: unknown) {
  Object.defineProperty(navigator, nome, { value: valor, configurable: true });
}

function noAparelho(ua: string) {
  definir("userAgent", ua);
  definir("maxTouchPoints", ua === WINDOWS ? 0 : 5);
}

/** Uma cópia nova do módulo: o que acontece quando a Lupa é aberta. */
async function importar() {
  vi.resetModules();
  return import("@/components/instalar-app");
}

async function montar() {
  const { InstalarApp } = await importar();
  return render(<InstalarApp />);
}

function pedidoFalso(escolha: "accepted" | "dismissed") {
  const pedido = new Event("beforeinstallprompt") as PedidoDeInstalacao;
  pedido.prompt = vi.fn().mockResolvedValue(undefined);
  pedido.userChoice = Promise.resolve({ outcome: escolha });
  return pedido;
}

const botaoInstalar = () => screen.getByRole("button", { name: "Instalar" });

beforeEach(() => {
  window.__lupaPedidoDeInstalacao = undefined;
  window.__lupaInstalado = undefined;
});

afterEach(() => {
  definir("standalone", undefined);
  definir("getInstalledRelatedApps", undefined);
  Reflect.deleteProperty(window, "matchMedia");
});

describe("quem vê o convite", () => {
  it("no computador, nada", async () => {
    noAparelho(WINDOWS);
    const { container } = await montar();
    expect(container).toBeEmptyDOMElement();
  });

  it("aberto como app no iPhone, nada", async () => {
    noAparelho(IPHONE);
    definir("standalone", true);
    const { container } = await montar();
    expect(container).toBeEmptyDOMElement();
  });

  it("aberto como app no Android, nada", async () => {
    noAparelho(ANDROID);
    window.matchMedia = ((q: string) => ({
      matches: q === "(display-mode: standalone)",
    })) as unknown as typeof window.matchMedia;
    const { container } = await montar();
    expect(container).toBeEmptyDOMElement();
  });

  it("o Android que diz já ter o app instalado esconde o convite", async () => {
    noAparelho(ANDROID);
    definir(
      "getInstalledRelatedApps",
      vi.fn().mockResolvedValue([{ platform: "webapp" }]),
    );
    await montar();
    expect(botaoInstalar()).toBeVisible();

    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
  });
});

describe("no iPhone", () => {
  it("o toque mostra os passos do Compartilhar", async () => {
    noAparelho(IPHONE);
    await montar();

    expect(botaoInstalar()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Adicionar à Tela de Início/)).not.toBeVisible();

    fireEvent.click(botaoInstalar());

    expect(botaoInstalar()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeVisible();
    expect(screen.getByText("Compartilhar")).toBeVisible();
  });

  it("dentro do Instagram, explica como abrir no navegador", async () => {
    noAparelho(INSTAGRAM);
    await montar();
    fireEvent.click(botaoInstalar());

    expect(screen.getByText(/não deixam instalar/)).toBeVisible();
    expect(screen.getByText("Abrir no navegador")).toBeVisible();
  });
});

describe("no Android", () => {
  it("sem o pedido do navegador, o toque mostra o caminho pelo menu", async () => {
    noAparelho(ANDROID);
    await montar();
    fireEvent.click(botaoInstalar());

    expect(screen.getByText("Instalar app")).toBeVisible();
  });

  it("com o pedido, o toque abre a instalação, e aceito o convite some", async () => {
    noAparelho(ANDROID);
    const pedido = pedidoFalso("accepted");
    window.__lupaPedidoDeInstalacao = pedido;
    await montar();

    // Instala direto: não há passos para abrir.
    expect(botaoInstalar()).not.toHaveAttribute("aria-expanded");

    await act(async () => {
      fireEvent.click(botaoInstalar());
    });

    expect(pedido.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();
  });

  it("recusada a janela, o próximo toque mostra o menu, sem pedir de novo", async () => {
    noAparelho(ANDROID);
    const pedido = pedidoFalso("dismissed");
    window.__lupaPedidoDeInstalacao = pedido;
    await montar();

    await act(async () => {
      fireEvent.click(botaoInstalar());
    });
    fireEvent.click(botaoInstalar());

    expect(pedido.prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Instalar app")).toBeVisible();
  });

  it("o pedido que chega depois da tela montada passa a instalar direto", async () => {
    noAparelho(ANDROID);
    await montar();
    expect(botaoInstalar()).toHaveAttribute("aria-expanded", "false");

    act(() => {
      window.__lupaPedidoDeInstalacao = pedidoFalso("accepted");
      window.dispatchEvent(new Event(EVENTO_INSTALAVEL));
    });

    expect(botaoInstalar()).not.toHaveAttribute("aria-expanded");
  });
});

describe('"Agora não"', () => {
  it("esconde, e trocar de tela não traz de volta", async () => {
    noAparelho(IPHONE);
    const { InstalarApp } = await importar();
    const primeira = render(<InstalarApp />);

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("button", { name: "Instalar" })).toBeNull();

    // Outra tela do mesmo carregamento monta o componente de novo.
    primeira.unmount();
    const { container } = render(<InstalarApp />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não grava nada no aparelho: abrir de novo traz o convite", async () => {
    noAparelho(IPHONE);
    localStorage.clear();
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(localStorage.length).toBe(0);

    cleanup();
    await montar();
    expect(botaoInstalar()).toBeVisible();
  });
});
