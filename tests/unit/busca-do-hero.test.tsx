/**
 * A busca do hero e o alternador Vagas/Serviços (#341).
 *
 * O que se cobra aqui é o que o usuário sente quando quebra: a busca chega
 * à lista certa com os filtros preenchidos, a troca entre vagas e serviços
 * não perde o termo nem o lugar, e o visitante sabe que vai entrar.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlternarBusca } from "@/components/alternar-busca";
import { BuscaDoHero } from "@/components/busca-do-hero";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ufs = [
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "SP", nome: "São Paulo" },
];
const atalhos = {
  vagas: [
    { rotulo: "Administrativo", href: "/vagas?categoria=Administrativo" },
  ],
  servicos: [{ rotulo: "Diarista", href: "/servicos?categoria=diarista" }],
};

function hero(props: Partial<Parameters<typeof BuscaDoHero>[0]> = {}) {
  return render(
    <BuscaDoHero ufs={ufs} atalhos={atalhos} visitante={false} {...props} />,
  );
}

describe("BuscaDoHero", () => {
  beforeEach(() => push.mockClear());

  it("busca vagas por padrão, com o termo e o estado na URL", () => {
    hero();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "  auxiliar  " },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "MT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledWith("/vagas?q=auxiliar&uf=MT");
  });

  it("trocar para Serviços leva a busca para /servicos", () => {
    hero();
    fireEvent.click(screen.getByRole("button", { name: "Serviços" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "diarista" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledWith("/servicos?q=diarista");
  });

  it("não deixa campo vazio na URL", () => {
    hero();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(push).toHaveBeenCalledWith("/vagas");
  });

  /** Ordenar não é filtrar: o estado da conta não vira filtro sem pedir. */
  it("o estado começa em Todo o Brasil", () => {
    hero();
    expect(screen.getByLabelText("Estado")).toHaveValue("");
  });

  it("sem JavaScript, o formulário ainda envia GET para /vagas", () => {
    hero();
    const form = screen.getByRole("searchbox").closest("form");
    expect(form).toHaveAttribute("method", "GET");
    expect(form).toHaveAttribute("action", "/vagas");
  });

  it("o alternador diz qual está ativo e muda placeholder e atalhos", () => {
    hero();
    const vagas = screen.getByRole("button", { name: "Vagas" });
    const servicos = screen.getByRole("button", { name: "Serviços" });
    expect(vagas).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Administrativo" })).toBeVisible();

    fireEvent.click(servicos);

    expect(servicos).toHaveAttribute("aria-pressed", "true");
    expect(vagas).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "Diarista" })).toHaveAttribute(
      "href",
      "/servicos?categoria=diarista",
    );
    expect(screen.queryByRole("link", { name: "Administrativo" })).toBeNull();
  });

  /** Aviso antes do clique: a busca de quem não tem conta termina no login. */
  it("visitante é avisado de que entra para ver os resultados", () => {
    hero({ visitante: true });
    expect(screen.getByText(/entre ou crie sua conta/i)).toBeInTheDocument();
  });

  it("quem já entrou não vê o aviso", () => {
    hero({ visitante: false });
    expect(screen.queryByText(/entre ou crie sua conta/i)).toBeNull();
  });

  /** Abaixo de 16 px o Safari do iPhone amplia a página ao focar (#314). */
  it("o campo de busca é de 16 px, e os controles têm 44 px", () => {
    hero();
    expect(screen.getByRole("searchbox").className).toContain("text-base");
    expect(screen.getByRole("button", { name: "Vagas" }).className).toContain(
      "h-11",
    );
    expect(
      screen.getByRole("link", { name: "Administrativo" }).className,
    ).toContain("min-h-11");
  });
});

describe("AlternarBusca", () => {
  it("marca a busca atual e leva o termo e o lugar para a outra", () => {
    render(
      <AlternarBusca atual="vagas" q="diarista" uf="MT" cidade="Sinop - MT" />,
    );

    expect(screen.getByRole("link", { name: "Vagas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const servicos = screen.getByRole("link", { name: "Serviços" });
    expect(servicos).not.toHaveAttribute("aria-current");

    const url = new URL(servicos.getAttribute("href") ?? "", "http://x");
    expect(url.pathname).toBe("/servicos");
    expect(url.searchParams.get("q")).toBe("diarista");
    expect(url.searchParams.get("uf")).toBe("MT");
    expect(url.searchParams.get("cidade")).toBe("Sinop - MT");
  });

  /** Categoria de vaga não é slug de serviço: levar deixaria a lista vazia. */
  it("não leva categoria nem tipo, que têm vocabulário próprio", () => {
    render(<AlternarBusca atual="servicos" q="x" />);
    const href = screen
      .getByRole("link", { name: "Vagas" })
      .getAttribute("href");
    expect(href).toBe("/vagas?q=x");
  });

  it("sem busca nenhuma, os links são limpos", () => {
    render(<AlternarBusca atual="vagas" />);
    expect(screen.getByRole("link", { name: "Serviços" })).toHaveAttribute(
      "href",
      "/servicos",
    );
  });
});
