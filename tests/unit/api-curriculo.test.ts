/**
 * @vitest-environment node
 *
 * O currículo em PDF tem teto por pessoa (#425).
 *
 * É o `GET` mais caro de CPU do app — o documento é montado do zero a cada
 * chamada — e o teto de `criarAcao` não alcança rota. O que se prova aqui
 * é que o excesso responde 429 **sem** chegar a montar o PDF.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sessao: { usuarioId: "u-curriculo", papel: "candidato_clt" } as {
    usuarioId: string;
    papel: string;
  } | null,
  gerados: 0,
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));
vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => estado.sessao,
}));
vi.mock("@/server/curriculo/servico", () => ({
  gerarCurriculoDoCandidato: async () => {
    estado.gerados += 1;
    return Buffer.from("%PDF-1.7");
  },
}));

import { GET } from "@/app/api/curriculo/route";
import { limparLimites } from "@/server/auth/rate-limit";
import { ORCAMENTO_DO_CURRICULO_PDF } from "@/server/limites";

describe("GET /api/curriculo", () => {
  beforeEach(() => {
    limparLimites();
    estado.gerados = 0;
    estado.sessao = { usuarioId: "u-curriculo", papel: "candidato_clt" };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("passado o teto, responde 429 sem montar o PDF", async () => {
    const { chamadas } = ORCAMENTO_DO_CURRICULO_PDF;
    for (let i = 0; i < chamadas; i++) {
      expect((await GET()).status).toBe(200);
    }

    const alem = await GET();

    expect(alem.status).toBe(429);
    expect(estado.gerados).toBe(chamadas);
  });

  it("o teto é de cada pessoa", async () => {
    for (let i = 0; i < ORCAMENTO_DO_CURRICULO_PDF.chamadas; i++) await GET();

    estado.sessao = { usuarioId: "outra-pessoa", papel: "candidato_clt" };
    expect((await GET()).status).toBe(200);
  });
});
