/**
 * O pedido de confirmação de e-mail na área de contratação (#560).
 *
 * O aviso de candidatura (#543) só vai para e-mail confirmado. O que se prova:
 * quem não confirmou lê o porquê e tem o botão de reenviar; quem confirmou
 * não vê nada; e o perfil continua com o texto dele.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/perfil/actions-email", () => ({
  reenviarComEstado: async () => ({}),
}));

const { ConfirmarParaAvisos } = await import(
  "@/app/(app)/_contratacao/confirmar-para-avisos"
);
const { ConfirmarEmail } = await import("@/app/(app)/perfil/confirmar-email");

describe("ConfirmarParaAvisos", () => {
  it("sem e-mail confirmado, diz que o aviso de candidatura depende disso", () => {
    render(<ConfirmarParaAvisos verificado={false} />);

    expect(
      screen.getByText(/Confirme seu e-mail para saber de cada candidatura/),
    ).toBeInTheDocument();
    expect(screen.getByText(/só para e-mail confirmado/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reenviar confirmação" }),
    ).toBeInTheDocument();
  });

  it("com e-mail confirmado, não aparece", () => {
    const { container } = render(<ConfirmarParaAvisos verificado />);
    expect(container).toBeEmptyDOMElement();
  });

  it("o perfil continua com o texto da recuperação de conta", () => {
    render(<ConfirmarEmail verificado={false} />);
    expect(screen.getByText(/recuperar a conta/)).toBeInTheDocument();
    expect(screen.queryByText(/cada candidatura/)).toBeNull();
  });
});
