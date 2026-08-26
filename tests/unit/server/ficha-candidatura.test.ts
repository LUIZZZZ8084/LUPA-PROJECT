/**
 * @vitest-environment node
 *
 * Quem alcança a ficha de um candidato.
 *
 * A ficha carrega telefone, e-mail e currículo de alguém que está
 * procurando emprego. O que autoriza a empresa a ver isso é uma coisa só:
 * a pessoa se candidatou à vaga dela. Estes testes cobram esse limite pelo
 * caminho que o atacante usaria — trocando o id na URL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Produção: a empresa é a da sessão, não a empresa de demonstração.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

/** A ficha lê pela camada de dados; aqui ela devolve uma lista controlada. */
const candidaturas: Record<string, unknown[]> = {};

vi.mock("@/lib/data", () => ({
  empresaDoPainel: (id: string) => id,
  getCompanyApplications: async (empresaId: string) =>
    candidaturas[empresaId] ?? [],
}));

vi.mock("@/server/arquivos/perfil", () => ({
  linkDoCurriculo: async (caminho: string | null) =>
    caminho ? `https://exemplo/assinado/${caminho}` : null,
}));

import type { Autenticado } from "@/server/auth/rbac";
import { fichaDaCandidatura } from "@/server/candidaturas/ficha";

const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const outraEmpresa: Autenticado = { usuarioId: "empresa-2", papel: "empresa" };
const candidato: Autenticado = {
  usuarioId: "candidato-1",
  papel: "candidato_clt",
};
const admin: Autenticado = { usuarioId: "admin-1", papel: "admin" };

const CANDIDATURA = {
  id: "cand-1",
  job_id: "vaga-1",
  candidate_id: "candidato-1",
  status: "enviada",
  created_at: "2026-08-25T12:00:00.000Z",
  job_title: "Operador de Empilhadeira",
  candidate: {
    full_name: "Everton Rodrigues",
    avatar_url: null,
    neighborhood: "Centro",
    city: "Sinop",
    email: "everton@teste.lupa",
    phone: "6600000001",
    desired_area: "Logística",
    availability: "Imediata",
    summary: null,
    experiences: [],
    education: null,
    skills: [],
    resume_url: "curriculos/candidato-1.pdf",
  },
};

beforeEach(() => {
  for (const chave of Object.keys(candidaturas)) delete candidaturas[chave];
  candidaturas["empresa-1"] = [CANDIDATURA];
});

describe("quem abre a ficha", () => {
  it("a empresa dona da vaga vê o candidato inteiro", async () => {
    const ficha = await fichaDaCandidatura(empresa, "cand-1");

    expect(ficha?.candidatura.candidate.full_name).toBe("Everton Rodrigues");
    expect(ficha?.candidatura.candidate.phone).toBe("6600000001");
    expect(ficha?.candidatura.candidate.email).toBe("everton@teste.lupa");
  });

  /*
   * Este é o teste que importa. Sem ele, trocar o id na URL entregaria o
   * telefone de um candidato de outra empresa — e a lista de quem está
   * procurando emprego numa cidade pequena tem valor para quem não deveria
   * tê-la.
   */
  it("outra empresa não alcança, mesmo com o id na mão", async () => {
    expect(await fichaDaCandidatura(outraEmpresa, "cand-1")).toBeNull();
  });

  it("candidato não abre ficha de ninguém", async () => {
    expect(await fichaDaCandidatura(candidato, "cand-1")).toBeNull();
  });

  it("admin também não — administra, não recruta", async () => {
    expect(await fichaDaCandidatura(admin, "cand-1")).toBeNull();
  });

  it("sem sessão, nada", async () => {
    expect(await fichaDaCandidatura(null, "cand-1")).toBeNull();
  });

  /*
   * `null` para "não existe" e para "não é sua", igual. Erro diferente em
   * cada caso confirmaria a existência do registro para quem sonda ids.
   */
  it("id que não existe devolve o mesmo que id de outra empresa", async () => {
    const inexistente = await fichaDaCandidatura(empresa, "cand-inexistente");
    const deOutra = await fichaDaCandidatura(outraEmpresa, "cand-1");

    expect(inexistente).toBe(deOutra);
  });
});

describe("currículo", () => {
  it("o link nasce assinado, não vem do banco", async () => {
    const ficha = await fichaDaCandidatura(empresa, "cand-1");
    expect(ficha?.linkCurriculo).toBe(
      "https://exemplo/assinado/curriculos/candidato-1.pdf",
    );
  });

  it("sem currículo enviado, não há link", async () => {
    candidaturas["empresa-1"] = [
      {
        ...CANDIDATURA,
        candidate: { ...CANDIDATURA.candidate, resume_url: null },
      },
    ];

    const ficha = await fichaDaCandidatura(empresa, "cand-1");
    expect(ficha?.linkCurriculo).toBeNull();
  });
});
