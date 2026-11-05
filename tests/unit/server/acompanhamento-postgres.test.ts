/**
 * @vitest-environment node
 *
 * O repositório de acompanhamento no banco (#539): a hora de parede volta
 * sem os segundos que o `timestamp` traz, salvar é um upsert pela
 * candidatura, e lista vazia não consulta nada.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };

function construtor() {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta,
    single: async () => resposta,
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta).then(resolver),
  };
  for (const metodo of ["select", "eq", "in", "limit", "upsert"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ metodo, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  clienteDeServico: () => ({ from: () => construtor() }),
}));

import { RepositorioAcompanhamentoPostgres } from "@/server/acompanhamento/postgres";

const LINHA = {
  candidatura_id: "c1",
  anotacao: "Boa conversa.",
  entrevista_em: "2026-11-06T14:30:00",
  entrevista_local: "Sala 3",
  atualizado_em: "2026-11-05T10:00:00Z",
};

describe("RepositorioAcompanhamentoPostgres", () => {
  const repo = new RepositorioAcompanhamentoPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  it("lê a hora como a tela a escreve, sem segundos", async () => {
    resposta = { data: LINHA, error: null };
    expect(await repo.porCandidatura("c1")).toEqual({
      candidaturaId: "c1",
      anotacao: "Boa conversa.",
      entrevistaEm: "2026-11-06T14:30",
      entrevistaLocal: "Sala 3",
      atualizadoEm: "2026-11-05T10:00:00Z",
    });
  });

  it("sem entrevista, a hora é nula", async () => {
    resposta = {
      data: { ...LINHA, entrevista_em: null, entrevista_local: null },
      error: null,
    };
    const lido = await repo.porCandidatura("c1");
    expect(lido?.entrevistaEm).toBeNull();
    expect(lido?.entrevistaLocal).toBeNull();
  });

  it("id sem forma de uuid é 'não há', não erro", async () => {
    resposta = { data: null, error: { message: "x", code: "22P02" } };
    expect(await repo.porCandidatura("nao-e-uuid")).toBeNull();
  });

  it("lista vazia não consulta o banco", async () => {
    expect(await repo.porCandidaturas([])).toEqual([]);
    expect(chamadas).toHaveLength(0);
  });

  it("a lista tem teto", async () => {
    resposta = { data: [LINHA], error: null };
    expect(await repo.porCandidaturas(["c1"])).toHaveLength(1);
    expect(chamadas.some((c) => c.metodo === "limit")).toBe(true);
  });

  it("salvar é upsert pela candidatura", async () => {
    resposta = { data: LINHA, error: null };
    await repo.salvar({
      candidaturaId: "c1",
      anotacao: "Boa conversa.",
      entrevistaEm: "2026-11-06T14:30",
      entrevistaLocal: "Sala 3",
    });
    const upsert = chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.args[1]).toEqual({ onConflict: "candidatura_id" });
    expect(upsert?.args[0]).toMatchObject({
      candidatura_id: "c1",
      entrevista_em: "2026-11-06T14:30",
    });
  });

  it("erro do banco vira indisponível", async () => {
    resposta = { data: null, error: { message: "caiu" } };
    await expect(repo.porCandidaturas(["c1"])).rejects.toThrow();
  });
});
