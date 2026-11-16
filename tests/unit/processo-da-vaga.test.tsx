/**
 * O processo seletivo de uma vaga (#612): quem abre, e o que a página diz.
 *
 * O e2e roda em demonstração, onde toda conta vê a empresa fictícia; a
 * posse da vaga e o portão se provam aqui, com a regra de produção.
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DIA = 86_400_000;
const vaga = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  company_id: "emp-1",
  title: "Operador de Máquinas",
  city: "Sinop - MT",
  status: "aberta",
  created_at: "2026-11-01T15:00:00Z",
  expires_at: new Date(Date.now() + 20 * DIA).toISOString(),
  removed_at: null,
  skills: [],
  applicant_count: 0,
  company: { company_name: "Agro Norte" },
  ...extra,
});
const candidatura = (id: string, job_id: string, status: string) => ({
  id,
  job_id,
  job_title: "Operador de Máquinas",
  candidate_id: `p-${id}`,
  status,
  created_at: "2026-11-05T12:00:00Z",
  answers: null,
  job_questions: [],
  candidate: { full_name: `Pessoa ${id}`, avatar_url: null, phone: null },
});

const estado = vi.hoisted(() => ({
  temPainel: true,
  vagas: [] as unknown[],
  candidaturas: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/empresa/vagas/v1",
  useRouter: () => ({ replace: () => {} }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/auth/cookies", () => ({
  sessaoOuEntrar: async () => ({ usuarioId: "emp-1", papel: "empresa" }),
}));
vi.mock("@/lib/data", () => ({
  empresaDoPainel: (id: string) => id,
  getCompany: async () => ({ company_name: "Agro Norte" }),
  getCompanyJobs: async () => estado.vagas,
  getCompanyApplications: async () => estado.candidaturas,
}));
vi.mock("@/server/visualizacoes/servico", () => ({
  temPainelDeEmpresa: () => estado.temPainel,
}));
vi.mock("@/server/acompanhamento/servico", () => ({
  acompanhamentosDe: async () => new Map(),
}));
vi.mock("@/server/candidaturas/match", () => ({
  matchPorCandidatura: () => new Map(),
}));
vi.mock("@/app/(app)/_contratacao/actions", () => ({
  moverCandidatura: async () => ({ ok: true }),
  encerrarVaga: async () => ({ ok: true }),
  reativarVaga: async () => ({ ok: true }),
}));

import { AREA_EMPRESA } from "@/app/(app)/_contratacao/area";
import { ProcessoDaVaga } from "@/app/(app)/_contratacao/processo";

const abrir = (id: string) =>
  ProcessoDaVaga({
    area: AREA_EMPRESA,
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  });

beforeEach(() => {
  estado.temPainel = true;
  estado.vagas = [vaga("v1")];
  estado.candidaturas = [
    candidatura("a", "v1", "enviada"),
    candidatura("b", "v1", "contatada"),
    candidatura("c", "v1", "contatada"),
    // De outra vaga da mesma empresa: não entra nesta página.
    candidatura("z", "v2", "entrevista"),
  ];
});

describe("processo seletivo da vaga", () => {
  it("vaga que não é da empresa da sessão é 404, como a que não existe", async () => {
    await expect(abrir("vaga-de-outra-empresa")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("quem não tem painel de empresa não abre", async () => {
    estado.temPainel = false;
    await expect(abrir("v1")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("conta por etapa só as candidaturas desta vaga, e lista só elas", async () => {
    render(await abrir("v1"));

    expect(screen.getByText("3 candidaturas")).toBeInTheDocument();
    const etapas = screen.getByRole("list", { name: "Candidatos por etapa" });
    const numero = (rotulo: string) =>
      within(etapas).getByText(rotulo).previousElementSibling?.textContent;
    expect(numero("Nova")).toBe("1");
    expect(numero("Contatado")).toBe("2");
    expect(numero("Entrevista")).toBe("0");

    expect(screen.getByText("Pessoa a")).toBeInTheDocument();
    expect(screen.queryByText("Pessoa z")).toBeNull();
    expect(screen.getByText(/Publicada em 01\/11\/2026/)).toBeInTheDocument();
  });

  it("no ar oferece editar e encerrar; nada de pausar", async () => {
    render(await abrir("v1"));
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/empresa/vagas/v1/editar",
    );
    expect(
      screen.getByRole("button", { name: /Encerrar/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pausar/ })).toBeNull();
  });

  it("expirada oferece reativar, e não editar", async () => {
    estado.vagas = [
      vaga("v1", { expires_at: new Date(Date.now() - DIA).toISOString() }),
    ];
    render(await abrir("v1"));
    expect(screen.getByText("Expirada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reativar/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Editar" })).toBeNull();
  });

  it("encerrada sem candidato diz que não recebe candidaturas", async () => {
    estado.vagas = [vaga("v1", { status: "fechada" })];
    estado.candidaturas = [];
    render(await abrir("v1"));
    expect(screen.getByText("Encerrada")).toBeInTheDocument();
    expect(screen.getByText(/não está no ar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Encerrar/ })).toBeNull();
  });
});
