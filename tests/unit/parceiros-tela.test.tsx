/**
 * A tela de parceiros do admin (#505).
 *
 * A suíte e2e não tem sessão de admin, então é aqui que a tela é desenhada:
 * cada situação diz o que fazer, "sem prazo" é o padrão do formulário, o que
 * se digita chega à action como foi digitado, e encerrar pede confirmação.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinhaDeParceria } from "@/server/parceiros/tipos";

const chamadas = vi.hoisted(() => ({
  autorizar: [] as unknown[],
  encerrar: [] as unknown[],
  refresh: 0,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {
      chamadas.refresh += 1;
    },
  }),
}));
vi.mock("@/app/(app)/admin/actions", () => ({
  autorizarParceiroAction: async (dados: unknown) => {
    chamadas.autorizar.push(dados);
    return { ok: true, dados: { id: "nova" } };
  },
  encerrarParceriaAction: async (dados: unknown) => {
    chamadas.encerrar.push(dados);
    return { ok: true, dados: dados };
  },
}));

const { Parceiros } = await import(
  "@/app/(app)/admin/parceiros/parceiros-cliente"
);

const linha = (
  parcial: Partial<LinhaDeParceria> & Pick<LinhaDeParceria, "situacao">,
): LinhaDeParceria => ({
  id: "p-1",
  email: "rh@agronorte.com",
  nome: "Agro Norte",
  validoAte: null,
  criadoEm: "2026-10-27T12:00:00.000Z",
  encerradoEm: null,
  usuarioId: null,
  concedidoAte: null,
  ...parcial,
});

beforeEach(() => {
  chamadas.autorizar = [];
  chamadas.encerrar = [];
  chamadas.refresh = 0;
});

describe("tela de parceiros", () => {
  it("cada situação diz o que fazer, e o prazo aparece por extenso", () => {
    render(
      <Parceiros
        linhas={[
          linha({ id: "a", situacao: "ativa" }),
          linha({
            id: "b",
            nome: "Prefeitura",
            email: "rh@prefeitura.gov.br",
            situacao: "email_nao_confirmado",
            validoAte: "2027-06-30T02:59:59.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Ativa")).toBeTruthy();
    expect(screen.getByText("E-mail não confirmado")).toBeTruthy();
    expect(screen.getByText(/link de confirmação/i)).toBeTruthy();
    expect(screen.getByText(/sem prazo/i)).toBeTruthy();
    expect(screen.getByText(/até 29\/06\/2027/i)).toBeTruthy();
  });

  it("sem parceria nenhuma, o formulário já vem aberto, com 'sem prazo' marcado", () => {
    render(<Parceiros linhas={[]} />);

    expect(
      (screen.getByLabelText("Sem prazo") as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.queryByLabelText("Vale até")).toBeNull();
  });

  it("autoriza com o que foi digitado e recarrega a lista", async () => {
    render(<Parceiros linhas={[]} />);

    fireEvent.change(screen.getByLabelText("Nome da parceria"), {
      target: { value: "Agro Norte" },
    });
    fireEvent.change(screen.getByLabelText("E-mail da conta do parceiro"), {
      target: { value: "rh@agronorte.com" },
    });
    fireEvent.click(screen.getByLabelText("Até uma data"));
    fireEvent.change(screen.getByLabelText("Vale até"), {
      target: { value: "2027-06-30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Autorizar" }));

    await waitFor(() => expect(chamadas.refresh).toBe(1));
    expect(chamadas.autorizar).toEqual([
      {
        nome: "Agro Norte",
        email: "rh@agronorte.com",
        prazo: "ate_data",
        ate: "2027-06-30",
      },
    ]);
  });

  it("encerrar pede confirmação antes de chamar a action", async () => {
    render(<Parceiros linhas={[linha({ situacao: "ativa" })]} />);

    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(chamadas.encerrar).toEqual([]);
    expect(screen.getByText(/pagou por conta própria/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Encerrar parceria" }));
    await waitFor(() => expect(chamadas.encerrar).toEqual([{ id: "p-1" }]));
  });

  it("encerrada e vencida ficam à parte, sem botão de encerrar", () => {
    render(
      <Parceiros
        linhas={[
          linha({
            situacao: "encerrada",
            encerradoEm: "2026-10-28T12:00:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByText(/encerradas e vencidas/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Encerrar" })).toBeNull();
  });
});
