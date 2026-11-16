import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConvidarParaVaga,
  mensagemDeConvite,
} from "@/app/(app)/_contratacao/convidar-para-vaga";

describe("convidar um talento para uma vaga (#620)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("a mensagem diz quem chama, por que lembrou da pessoa, e leva o link", () => {
    const m = mensagemDeConvite({
      nome: "Everton Rodrigues",
      empresa: "Agro Norte",
      cargo: "Operador",
      cidade: "Sinop - MT",
      link: "https://lupapp.com.br/vagas/v1",
    });
    expect(m).toMatch(/^Olá, Everton! Aqui é da Agro Norte\./);
    expect(m).toContain("Operador em Sinop - MT");
    expect(m).toMatch(/vagas\/v1$/);
  });

  it("abre o WhatsApp da pessoa com a vaga escolhida", () => {
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ConvidarParaVaga
        nome="Everton Rodrigues"
        telefone="66999990000"
        empresa="Agro Norte"
        vagas={[
          { id: "v1", titulo: "Operador", cidade: "Sinop - MT" },
          { id: "v2", titulo: "Analista", cidade: "Sinop - MT" },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Vaga para convidar/), {
      target: { value: "v2" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Convidar Everton Rodrigues no WhatsApp",
      }),
    );
    const url = decodeURIComponent(String(abrir.mock.calls[0][0]));
    expect(url).toMatch(/^https:\/\/wa\.me\/5566999990000\?text=/);
    expect(url).toContain("vaga de Analista");
    expect(url).toContain("/vagas/v2");
  });
});
