/**
 * "Encerrar" vaga sem a caixa do navegador e sem o vermelho cheio (#481).
 *
 * Era um botão vermelho por vaga, e o clique abria o `confirm()` nativo. Agora
 * "Encerrar" é um botão de contorno, o clique abre um quadro de confirmação na
 * tela (o mesmo padrão do cancelamento de assinatura), e só o botão de
 * confirmar é vermelho. O que se cobra: nada se encerra no primeiro clique,
 * "Voltar" desiste de verdade, e o `confirm()` não é mais chamado.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const encerrarVaga = vi.fn();
vi.mock("@/app/(app)/_contratacao/actions", () => ({
  encerrarVaga: (...args: unknown[]) => encerrarVaga(...args),
}));

import { EncerrarVagaButton } from "@/app/(app)/_contratacao/encerrar-vaga-button";

function montar() {
  return render(
    <EncerrarVagaButton id="vaga-1" titulo="Operador de Máquinas Agrícolas" />,
  );
}

const abrir = () =>
  fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));

beforeEach(() => {
  encerrarVaga.mockReset();
  vi.spyOn(window, "confirm").mockImplementation(() => true);
});

describe("EncerrarVagaButton", () => {
  it("começa discreto: botão de contorno, sem vermelho e sem quadro aberto", () => {
    montar();
    const botao = screen.getByRole("button", { name: "Encerrar" });

    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao.className).toContain("border-line");
    expect(botao.className).not.toContain("bg-danger");
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("o primeiro clique só abre a confirmação: nada é encerrado, e não há confirm() do navegador", () => {
    montar();
    abrir();

    expect(window.confirm).not.toHaveBeenCalled();
    expect(encerrarVaga).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Encerrar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("group", {
        name: "Confirmar o encerramento de Operador de Máquinas Agrícolas",
      }),
    ).toBeInTheDocument();
  });

  it("o quadro diz o que acontece com a vaga e com os currículos", () => {
    montar();
    abrir();

    const quadro = screen.getByRole("group");
    expect(quadro).toHaveTextContent("Operador de Máquinas Agrícolas");
    expect(quadro).toHaveTextContent("some da busca pública");
    expect(quadro).toHaveTextContent("currículos já recebidos continuam aqui");
  });

  it("só o botão de confirmar é vermelho", () => {
    montar();
    abrir();

    expect(
      screen.getByRole("button", { name: "Encerrar vaga" }).className,
    ).toContain("bg-danger");
    expect(
      screen.getByRole("button", { name: "Voltar" }).className,
    ).not.toContain("bg-danger");
  });

  it("'Voltar' desiste: fecha o quadro e não encerra nada", () => {
    montar();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("group")).toBeNull();
    expect(encerrarVaga).not.toHaveBeenCalled();
  });

  it("tocar de novo em 'Encerrar' também fecha o quadro", () => {
    montar();
    abrir();
    abrir();

    expect(screen.queryByRole("group")).toBeNull();
  });

  it("'Encerrar vaga' encerra a vaga certa, uma vez", async () => {
    encerrarVaga.mockResolvedValue({ ok: true });
    montar();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar vaga" }));

    await waitFor(() => expect(encerrarVaga).toHaveBeenCalledTimes(1));
    expect(encerrarVaga).toHaveBeenCalledWith({ id: "vaga-1" });
  });

  it("se encerrar falha, mostra o motivo e fecha o quadro para tentar de novo", async () => {
    encerrarVaga.mockResolvedValue({
      ok: false,
      mensagem: "Vaga já encerrada.",
    });
    montar();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar vaga" }));

    await waitFor(() =>
      expect(screen.getByText("Vaga já encerrada.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "Encerrar" })).toBeEnabled();
  });
});
