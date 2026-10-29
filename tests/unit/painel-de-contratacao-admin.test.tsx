/**
 * O admin tem a página de empresa dele (#499).
 *
 * Pedido do Luiz em 27/10/2026: a conta de administração abre a área de
 * contratação inteira para olhar. O que se prova aqui é o que a tela faz com
 * o admin — o painel completo antes da primeira vaga, com os planos e os
 * atalhos à vista, em vez do estado vazio que os esconde — e que a exceção é
 * dele: uma conta de empresa sem perfil continua lendo o estado de erro, e o
 * candidato continua lendo a explicação.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sessao: { usuarioId: "adm-1", papel: "admin" } as {
    usuarioId: string;
    papel: string;
  },
  empresa: null as unknown,
  nome: "Administrador da Lupa",
  redirecionou: null as string | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/empresa",
  redirect: (destino: string) => {
    estado.redirecionou = destino;
    throw new Error(`NEXT_REDIRECT:${destino}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/auth/cookies", () => ({
  sessaoOuEntrar: async () => estado.sessao,
}));
vi.mock("@/server/auth/servico", () => ({
  usuarioDaSessao: async (id: string) => ({
    id,
    nomeCompleto: estado.nome,
    cidade: "Sinop - MT",
  }),
}));
vi.mock("@/lib/data", () => ({
  empresaDoPainel: (id: string) => id,
  getCompany: async () => estado.empresa,
  getCompanyJobs: async () => [],
  getCompanyApplications: async () => [],
  getCompanyStats: async () => ({ active_jobs: 0, applications: 0 }),
}));
vi.mock("@/server/visualizacoes/servico", () => ({
  serieDoPainel: async () => [],
  visualizacoesPorVaga: async () => new Map<string, number>(),
  temPainelDeEmpresa: () => true,
  totaisDaSerie: () => ({ visualizacoes: 0, candidaturas: 0 }),
}));
vi.mock("@/server/candidaturas/recomendados", () => ({
  recomendadosParaEmpresa: async () => [],
}));
vi.mock("@/server/carteiras/servico", () => ({
  direitoDePublicar: async () => ({
    creditos: 0,
    mensalAtivo: false,
    mensalidadeValidaAte: null,
    limiteNoAr: null,
    noAr: 0,
    primeiraGratisDisponivel: false,
  }),
}));
vi.mock("@/app/(app)/_contratacao/actions", () => ({
  moverCandidatura: async () => ({ ok: true }),
  encerrarVaga: async () => ({ ok: true }),
  reativarVaga: async () => ({ ok: true }),
}));

const { PainelDeContratacao } = await import("@/app/(app)/_contratacao/painel");
const { AREA_EMPRESA, AREA_PRESTADOR, areaDoPapel } = await import(
  "@/app/(app)/_contratacao/area"
);

async function abrir(area = AREA_EMPRESA) {
  render(await PainelDeContratacao({ area }));
}

const hrefs = () =>
  [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));

describe("painel de contratação para o admin", () => {
  beforeEach(() => {
    estado.sessao = { usuarioId: "adm-1", papel: "admin" };
    estado.empresa = null;
    estado.redirecionou = null;
  });

  it("a área do admin é a da empresa", () => {
    expect(areaDoPapel("admin")).toBe(AREA_EMPRESA);
  });

  /**
   * Sem perfil gravado, o painel abria o estado vazio, que não tem as
   * abas nem os atalhos. O pedido era olhar a área inteira.
   */
  it("abre o painel completo antes da primeira vaga, com o nome da conta", async () => {
    await abrir();

    expect(screen.getByRole("heading", { name: "Minha Empresa" })).toBeTruthy();
    expect(screen.getByText("Administrador da Lupa")).toBeTruthy();
    expect(screen.queryByText(/nenhuma empresa vinculada/i)).toBeNull();

    expect(hrefs()).toEqual(
      expect.arrayContaining([
        "/empresa/creditos",
        "/empresa/talentos",
        "/empresa/vagas/nova",
        "/candidatos",
      ]),
    );
  });

  /**
   * Os cards de atalho viraram o tutorial de primeira visita (#513): o que
   * eles diziam aparece uma vez, e a busca só para quem pode buscar.
   */
  it("explica o painel num tutorial, e não em cards de atalho", async () => {
    localStorage.clear();
    await abrir();

    expect(
      screen.getByRole("heading", { name: "Publique uma vaga" }),
    ).toBeTruthy();
    expect(screen.getByText(/de 4$/)).toBeTruthy();
    expect(screen.queryByText(/Todo mundo que se candidatou/)).toBeNull();
  });

  it("o tutorial do prestador não fala da busca, que não é dele", async () => {
    localStorage.clear();
    estado.sessao = { usuarioId: "pre-1", papel: "prestador_servico" };
    estado.empresa = {
      profile_id: "pre-1",
      company_name: "João Eletricista",
      cnpj: null,
      logo_url: null,
      plan: "trial",
      site: null,
      instagram: null,
      facebook: null,
    };

    await abrir(AREA_PRESTADOR);

    expect(screen.getByText(/de 3$/)).toBeTruthy();
    expect(hrefs()).not.toContain("/candidatos");
  });

  it("usa o perfil de empresa quando ele já existe", async () => {
    estado.empresa = {
      profile_id: "adm-1",
      company_name: "Lupa Teste Ltda",
      cnpj: null,
      logo_url: null,
      plan: "trial",
      site: null,
      instagram: null,
      facebook: null,
    };

    await abrir();

    expect(screen.getByText("Lupa Teste Ltda")).toBeTruthy();
    expect(screen.queryByText("Administrador da Lupa")).toBeNull();
  });

  /** O admin que abre a porta do prestador vai para a dele, a da empresa. */
  it("em /contratar, leva para /empresa", async () => {
    await expect(abrir(AREA_PRESTADOR)).rejects.toThrow("NEXT_REDIRECT");
    expect(estado.redirecionou).toBe("/empresa");
  });
});

describe("a exceção é do admin", () => {
  beforeEach(() => {
    estado.empresa = null;
  });

  it("conta de empresa sem perfil continua lendo o estado de erro", async () => {
    estado.sessao = { usuarioId: "emp-1", papel: "empresa" };

    await abrir();

    expect(screen.getByText(/nenhuma empresa vinculada/i)).toBeTruthy();
    expect(hrefs()).not.toContain("/empresa/creditos");
  });

  it("candidato continua lendo a explicação, sem painel", async () => {
    estado.sessao = { usuarioId: "cand-1", papel: "candidato_clt" };

    await abrir();

    expect(screen.getByText(/sua conta ainda não contrata/i)).toBeTruthy();
  });
});
