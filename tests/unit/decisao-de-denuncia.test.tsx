/**
 * Os botões do admin diante de uma denúncia (#435).
 *
 * O painel não tem e2e — a suíte não tem sessão de admin —, então o que se
 * trava aqui é o que pode custar caro: tirar do ar pede um segundo clique,
 * descartar não tira nada, e o erro aparece em vez de sumir.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Resultado = { ok: true } | { ok: false; mensagem: string };
const decidir = vi.hoisted(() =>
  vi.fn(async (_: unknown): Promise<Resultado> => ({ ok: true })),
);
vi.mock("@/app/(app)/admin/actions", () => ({
  decideVerification: vi.fn(),
  decidirDenunciaAction: decidir,
}));

const { DecisaoDeDenuncia } = await import("@/app/(app)/admin/actions-ui");

beforeEach(() => {
  decidir.mockClear();
});

describe("decisão de denúncia", () => {
  it("tirar do ar pede confirmação antes de chamar o servidor", async () => {
    render(<DecisaoDeDenuncia alvo="vaga" alvoId="v1" />);

    fireEvent.click(screen.getByRole("button", { name: /tirar do ar/i }));
    expect(decidir).not.toHaveBeenCalled();
    expect(screen.getByText(/a vaga é encerrada e sai da busca/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Confirmar: tirar a vaga do ar" }),
      );
    });
    expect(decidir).toHaveBeenCalledWith({
      alvo: "vaga",
      alvoId: "v1",
      tirarDoAr: true,
    });
  });

  it("voltar desiste sem decidir nada", () => {
    render(<DecisaoDeDenuncia alvo="avaliacao" alvoId="a1" />);

    fireEvent.click(screen.getByRole("button", { name: /tirar do ar/i }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(decidir).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /descartar denúncia/i }));
  });

  it("descartar decide sem tirar nada do ar", async () => {
    render(<DecisaoDeDenuncia alvo="avaliacao" alvoId="a1" />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /descartar denúncia/i }),
      );
    });

    expect(decidir).toHaveBeenCalledWith({
      alvo: "avaliacao",
      alvoId: "a1",
      tirarDoAr: false,
    });
  });

  it("o erro do servidor aparece na tela", async () => {
    decidir.mockResolvedValueOnce({ ok: false, mensagem: "Serviço fora." });
    render(<DecisaoDeDenuncia alvo="vaga" alvoId="v1" />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /descartar denúncia/i }),
      );
    });

    expect(screen.getByRole("alert").textContent).toBe("Serviço fora.");
  });
});
