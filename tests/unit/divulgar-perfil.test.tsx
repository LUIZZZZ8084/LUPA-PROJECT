import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DivulgarPerfil, mensagemDoPerfil } from "@/components/divulgar-perfil";

const PERFIL = { categoria: "Eletricista", cidade: "Sinop - MT" };

describe("mensagemDoPerfil (#603)", () => {
  it("divulgar apresenta o serviço e manda para o perfil", () => {
    const m = mensagemDoPerfil(
      PERFIL,
      "https://lupapp.com.br/servicos/p1",
      "divulgar",
    );
    expect(m).toContain("eletricista em Sinop - MT");
    expect(m).toMatch(/servicos\/p1$/);
  });

  it("pedir avaliação leva direto ao formulário, pela âncora", () => {
    const m = mensagemDoPerfil(
      PERFIL,
      "https://lupapp.com.br/servicos/p1",
      "avaliar",
    );
    expect(m).toContain("avaliação");
    expect(m).toMatch(/servicos\/p1#avaliar$/);
  });
});

describe("DivulgarPerfil", () => {
  afterEach(() => vi.restoreAllMocks());

  it("os dois botões abrem o WhatsApp sem número, com a mensagem certa", () => {
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<DivulgarPerfil prestadorId="p 1" {...PERFIL} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Divulgar no WhatsApp/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Pedir avaliação/ }));

    const [divulgar, avaliar] = abrir.mock.calls.map((c) =>
      decodeURIComponent(String(c[0])),
    );
    expect(divulgar).toMatch(/^https:\/\/wa\.me\/\?text=Faço serviço/);
    expect(divulgar).toContain("/servicos/p%201");
    expect(avaliar).toContain("/servicos/p%201#avaliar");
  });

  it("sem área de transferência, o link aparece para copiar à mão", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("negado")) },
    });
    render(<DivulgarPerfil prestadorId="p1" {...PERFIL} />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("/servicos/p1");
  });
});
