/**
 * A página para empresas (#537).
 *
 * O que se prova: o preço que ela anuncia é o que o servidor cobra, item a
 * item; quem não tem conta recebe o caminho de criar a de empresa; quem já
 * contrata vai para o painel; há um título só na página; e a visita conta
 * para a conversão do painel do admin só quando a página oferece a conta
 * (#568).
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrecoBRL } from "@/lib/format";
import { OPCAO_AVULSA, PLANOS_DE_VAGA } from "@/lib/planos-empresa";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";

const estado = vi.hoisted(() => ({
  sessao: null as { usuarioId: string; papel: string } | null,
  visitas: [] as string[],
}));

vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => {
    void fn();
  },
}));
vi.mock("@/server/visitas", () => ({
  contarVisita: async (pagina: string) => {
    estado.visitas.push(pagina);
  },
}));

const { default: Pagina } = await import("@/app/(app)/para-empresas/page");

async function renderizar() {
  render(await Pagina());
}

describe("página para empresas", () => {
  beforeEach(() => {
    estado.sessao = null;
    estado.visitas = [];
  });

  it("anuncia o preço que o servidor cobra, em cada opção", async () => {
    const { container } = render(await Pagina());

    for (const opcao of [OPCAO_AVULSA, ...PLANOS_DE_VAGA]) {
      const no = container.querySelector(`[data-preco="${opcao.tipo}"]`);
      expect(no, opcao.tipo).not.toBeNull();
      // Comparação exata: o `Intl` separa "R$" do número com espaço fixo.
      expect(no?.textContent).toBe(
        formatPrecoBRL(PRECO_CENTAVOS[opcao.tipo] / 100),
      );
    }
  });

  it("sem conta, leva a criar a conta de empresa e a entrar", async () => {
    await renderizar();

    const criar = screen.getAllByRole("link", {
      name: /Criar conta de empresa/,
    });
    expect(criar.length).toBeGreaterThan(0);
    for (const link of criar) {
      expect(link).toHaveAttribute(
        "href",
        "/cadastro?tipo=empresa&de=para_empresas",
      );
    }
    expect(
      screen.getByRole("link", { name: "Já tenho conta" }),
    ).toHaveAttribute("href", "/entrar?destino=/empresa");
  });

  it("quem já contrata vai para o painel, sem convite para criar conta", async () => {
    estado.sessao = { usuarioId: "emp-1", papel: "empresa" };
    await renderizar();

    expect(
      screen.getByRole("link", { name: /Ir para o painel/ }),
    ).toHaveAttribute("href", "/empresa");
    expect(
      screen.queryByRole("link", { name: /Criar conta de empresa/ }),
    ).toBeNull();
  });

  it("candidato logado vê o cadastro de empresa, mas não o de entrar", async () => {
    estado.sessao = { usuarioId: "cnd-1", papel: "candidato_clt" };
    await renderizar();

    expect(
      screen.getAllByRole("link", { name: /Criar conta de empresa/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Já tenho conta" })).toBeNull();
  });

  it("sem conta, ou com conta que não contrata, a visita conta", async () => {
    await renderizar();
    estado.sessao = { usuarioId: "cnd-1", papel: "candidato_clt" };
    await renderizar();
    expect(estado.visitas).toEqual(["para_empresas", "para_empresas"]);
  });

  it("quem já contrata não entra na conta das visitas", async () => {
    for (const papel of ["empresa", "prestador_servico", "admin"]) {
      estado.sessao = { usuarioId: "x", papel };
      await renderizar();
    }
    expect(estado.visitas).toEqual([]);
  });

  it("tem um h1 só", async () => {
    await renderizar();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
