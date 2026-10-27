/**
 * @vitest-environment node
 *
 * A arte de story é da empresa que publicou a vaga (#490).
 *
 * O que está na imagem é público — a página da vaga mostra o mesmo —, mas a
 * rota é de dono: é a empresa que a pede, de dentro do app, e uma imagem de
 * 1080 × 1920 renderizada a cada chamada não se oferece a qualquer anônimo.
 * Vaga de outra empresa responde 404, igual a "não existe": 403 confirmaria
 * que o id existe.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sessao: { usuarioId: "empresa-1", papel: "empresa" } as {
    usuarioId: string;
    papel: string;
  } | null,
}));

// Sem banco, o limite de chamadas usa o contador em memória; a empresa da vaga
// é a da sessão por `empresaDoPainel`, trocado abaixo pelo comportamento de
// produção.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));
vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));

const vagas = vi.hoisted(() => ({
  porId: new Map<string, unknown>(),
}));
vi.mock("@/lib/data", () => ({
  getJobById: async (id: string) => vagas.porId.get(id) ?? null,
  empresaDoPainel: (usuarioId: string) => usuarioId,
}));

import { GET } from "@/app/api/vagas/[id]/arte/route";
import { limparLimites } from "@/server/auth/rate-limit";
import { ORCAMENTO_DA_ARTE_DA_VAGA } from "@/server/limites";

const VAGA = {
  id: "vaga-1",
  company_id: "empresa-1",
  title: "Operador de Máquinas",
  city: "Sinop - MT",
  neighborhood: null,
  address: "Av. das Itaúbas, 1200",
  contract_type: "CLT",
  salary_min: 2200,
  salary_max: 2800,
  company: { company_name: "Agro Norte" },
};

const chamar = (id = "vaga-1") =>
  GET(new Request(`http://localhost/api/vagas/${id}/arte`), {
    params: Promise.resolve({ id }),
  });

describe("GET /api/vagas/[id]/arte", () => {
  beforeEach(() => {
    limparLimites();
    vagas.porId.clear();
    vagas.porId.set("vaga-1", VAGA);
    estado.sessao = { usuarioId: "empresa-1", papel: "empresa" };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("o dono recebe um PNG para baixar", async () => {
    const resposta = await chamar();

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("content-type")).toBe("image/png");
    expect(resposta.headers.get("content-disposition")).toContain("attachment");
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    // Assinatura de PNG: a imagem foi renderizada de verdade.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // 1080 × 1920 no cabeçalho IHDR.
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint32(16)).toBe(1080);
    expect(dv.getUint32(20)).toBe(1920);
  }, 30_000);

  it("sem sessão, 404", async () => {
    estado.sessao = null;
    expect((await chamar()).status).toBe(404);
  });

  it("quem não publica vaga, 404", async () => {
    estado.sessao = { usuarioId: "empresa-1", papel: "candidato_clt" };
    expect((await chamar()).status).toBe(404);
  });

  it("vaga de outra empresa responde 404, igual a vaga que não existe", async () => {
    estado.sessao = { usuarioId: "empresa-2", papel: "empresa" };
    const deOutra = await chamar();
    const inexistente = await chamar("nao-existe");

    expect(deOutra.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(await deOutra.json()).toEqual(await inexistente.json());
  });

  it("o admin enxerga mas não gera a arte da empresa", async () => {
    estado.sessao = { usuarioId: "admin-1", papel: "admin" };
    expect((await chamar()).status).toBe(404);
  });

  it("passado o teto, responde 429", async () => {
    const { chamadas } = ORCAMENTO_DA_ARTE_DA_VAGA;
    for (let i = 0; i < chamadas; i++) {
      expect((await chamar()).status).toBe(200);
    }

    expect((await chamar()).status).toBe(429);
  }, 120_000);

  it("o teto é de cada pessoa", async () => {
    for (let i = 0; i < ORCAMENTO_DA_ARTE_DA_VAGA.chamadas; i++) await chamar();

    vagas.porId.set("vaga-2", {
      ...VAGA,
      id: "vaga-2",
      company_id: "empresa-2",
    });
    estado.sessao = { usuarioId: "empresa-2", papel: "empresa" };
    expect((await chamar("vaga-2")).status).toBe(200);
  }, 120_000);
});
