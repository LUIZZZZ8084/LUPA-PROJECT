/**
 * Visitas e chamadas do perfil do prestador (#604).
 *
 * O repositório soma por dia e respeita a janela; a rota do WhatsApp conta
 * a chamada de quem não é o dono e redireciona para o mesmo `wa.me`; e o
 * painel diz que é contagem, não gente.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sessao: { usuarioId: "cliente-1", papel: "candidato_clt" } as {
    usuarioId: string;
    papel: string;
  } | null,
  prestador: {
    profile_id: "prv-1",
    full_name: "João Silva",
    phone: "66999990000",
    category: { name: "Eletricista" },
  } as Record<string, unknown> | null,
  contados: [] as [string, string][],
}));

vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));
vi.mock("@/lib/data", () => ({
  getProviderById: async () => estado.prestador,
}));
vi.mock("@/lib/contato-whatsapp", () => ({
  buildContact: (phone: string) => ({ phone, message: "Olá!" }),
}));
vi.mock("@/server/contagens-prestador", () => ({
  contarNoPerfil: async (id: string, evento: string) => {
    estado.contados.push([id, evento]);
  },
}));

import { GET } from "@/app/(app)/servicos/[id]/whatsapp/route";
import { NumerosDoPerfil } from "@/components/numeros-do-perfil";
import { RepositorioContagensPrestadorMemoria } from "@/server/contagens-prestador/memoria";
import { inicioDaJanela } from "@/server/contagens-prestador/tipos";

function chamar(id = "prv-1") {
  return GET(new Request(`http://localhost/servicos/${id}/whatsapp`), {
    params: Promise.resolve({ id }),
  });
}

describe("rota do WhatsApp do prestador", () => {
  beforeEach(() => {
    estado.sessao = { usuarioId: "cliente-1", papel: "candidato_clt" };
    estado.contados = [];
  });

  it("conta a chamada e redireciona para o wa.me", async () => {
    const r = await chamar();
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.status).toBeLessThan(400);
    expect(r.headers.get("location")).toMatch(
      /^https:\/\/wa\.me\/5566999990000\?text=/,
    );
    expect(estado.contados).toEqual([["prv-1", "contato"]]);
  });

  it("o próprio prestador não conta", async () => {
    estado.sessao = { usuarioId: "prv-1", papel: "prestador_servico" };
    await chamar();
    expect(estado.contados).toEqual([]);
  });

  it("sem sessão ou sem prestador, 404 e nada contado", async () => {
    estado.sessao = null;
    expect((await chamar()).status).toBe(404);
    estado.sessao = { usuarioId: "cliente-1", papel: "candidato_clt" };
    const antes = estado.prestador;
    estado.prestador = null;
    expect((await chamar("nao-existe")).status).toBe(404);
    estado.prestador = antes;
    expect(estado.contados).toEqual([]);
  });
});

describe("contagens em memória", () => {
  const repo = new RepositorioContagensPrestadorMemoria();
  afterEach(() => {
    repo.limpar();
    vi.useRealTimers();
  });

  it("soma visitas e chamadas do prestador, separadas", async () => {
    await repo.registrar("p1", "visita");
    await repo.registrar("p1", "visita");
    await repo.registrar("p1", "contato");
    await repo.registrar("p2", "visita");
    expect(await repo.totais("p1", 30)).toEqual({ visitas: 2, contatos: 1 });
    expect(await repo.totais("p3", 30)).toEqual({ visitas: 0, contatos: 0 });
  });

  it("o que passou da janela não conta", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    await repo.registrar("p1", "visita");
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
    await repo.registrar("p1", "contato");
    expect(await repo.totais("p1", 30)).toEqual({ visitas: 0, contatos: 1 });
  });

  it("a janela de 30 dias começa 29 dias antes de hoje", () => {
    expect(inicioDaJanela(new Date("2026-11-09T12:00:00Z"), 30)).toBe(
      "2026-10-11",
    );
  });
});

describe("NumerosDoPerfil", () => {
  it("mostra os dois números e diz que é contagem, não gente", () => {
    render(<NumerosDoPerfil visitas={12} contatos={1} dias={30} />);
    expect(
      screen.getByRole("heading", { name: "Seu perfil nos últimos 30 dias" }),
    ).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Chamada no WhatsApp")).toBeInTheDocument();
    expect(screen.getByText(/não de pessoas/)).toBeInTheDocument();
  });

  it("zerado, convida a divulgar", () => {
    render(<NumerosDoPerfil visitas={0} contatos={0} dias={30} />);
    expect(screen.getByText(/Divulgue o link/)).toBeInTheDocument();
  });
});
