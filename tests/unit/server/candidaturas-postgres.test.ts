/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };

function construtor(tabela: string) {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta,
    single: async () => resposta,
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta).then(resolver),
  };

  for (const metodo of ["select", "eq", "insert", "update", "order"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({ from: (tabela: string) => construtor(tabela) }),
}));

import { RepositorioCandidaturasPostgres } from "@/server/candidaturas/postgres";

const LINHA = {
  id: "33333333-3333-4333-8333-000000000001",
  vaga_id: "22222222-2222-4222-8222-000000000001",
  candidato_id: "11111111-1111-4111-8111-000000000001",
  status: "enviada",
  criado_em: "2026-08-20T00:00:00.000Z",
};

describe("RepositorioCandidaturasPostgres", () => {
  const repo = new RepositorioCandidaturasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("traduz as colunas para os campos da aplicação", async () => {
    resposta = { data: LINHA, error: null };
    const candidatura = await repo.porId(LINHA.id);

    expect(candidatura).toEqual({
      id: LINHA.id,
      vagaId: LINHA.vaga_id,
      candidatoId: LINHA.candidato_id,
      status: "enviada",
      criadoEm: LINHA.criado_em,
    });
  });

  it("id sem forma de uuid é 'não encontrado'", async () => {
    resposta = { data: null, error: { message: "invalid", code: "22P02" } };
    expect(await repo.porId("nao-e-uuid")).toBeNull();
  });

  it("criar grava vaga_id e candidato_id", async () => {
    resposta = { data: LINHA, error: null };
    await repo.criar({
      vagaId: LINHA.vaga_id,
      candidatoId: LINHA.candidato_id,
    });

    const insercao = chamadas.find((c) => c.metodo === "insert");
    expect(insercao?.args[0]).toEqual({
      vaga_id: LINHA.vaga_id,
      candidato_id: LINHA.candidato_id,
    });
  });

  it("candidatura duplicada vira conflito, não erro genérico", async () => {
    resposta = {
      data: null,
      error: { message: "unique violation", code: "23505" },
    };
    await expect(
      repo.criar({ vagaId: LINHA.vaga_id, candidatoId: LINHA.candidato_id }),
    ).rejects.toMatchObject({ codigo: "conflito" });
  });

  it("moverEstagio grava o novo status", async () => {
    resposta = { data: { ...LINHA, status: "entrevista" }, error: null };
    const candidatura = await repo.moverEstagio(LINHA.id, "entrevista");

    expect(candidatura.status).toBe("entrevista");
    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.args[0]).toEqual({ status: "entrevista" });
  });

  it("mover estágio de candidatura inexistente é 'não encontrado'", async () => {
    resposta = { data: null, error: { message: "no rows", code: "PGRST116" } };
    await expect(
      repo.moverEstagio("nao-existe", "entrevista"),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("porVaga lista as candidaturas da vaga", async () => {
    resposta = { data: [LINHA], error: null };
    const candidaturas = await repo.porVaga(LINHA.vaga_id);

    expect(candidaturas).toHaveLength(1);
    expect(candidaturas[0].vagaId).toBe(LINHA.vaga_id);
  });

  it("porCandidato lista as candidaturas do candidato", async () => {
    resposta = { data: [LINHA], error: null };
    const candidaturas = await repo.porCandidato(LINHA.candidato_id);

    expect(candidaturas).toHaveLength(1);
    expect(candidaturas[0].candidatoId).toBe(LINHA.candidato_id);
  });

  it("listar devolve todas as candidaturas", async () => {
    resposta = { data: [LINHA], error: null };
    expect(await repo.listar()).toHaveLength(1);
  });
});
