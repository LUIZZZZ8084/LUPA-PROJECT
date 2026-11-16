/**
 * @vitest-environment node
 *
 * Talentos salvos no Postgres (#618): o que vai para o banco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  chamadas: [] as { metodo: string; args: unknown[] }[],
  resposta: {
    data: null as unknown,
    error: null as null | { message: string },
  },
}));

function construtor() {
  const b: Record<string, unknown> = {
    then: (r: (v: unknown) => unknown) =>
      Promise.resolve(estado.resposta).then(r),
  };
  for (const m of ["select", "eq", "upsert", "delete", "limit"]) {
    b[m] = (...args: unknown[]) => {
      estado.chamadas.push({ metodo: m, args });
      return b;
    };
  }
  return b;
}

vi.mock("@/lib/supabase/service", () => ({
  clienteDeServico: () => ({ from: () => construtor() }),
}));

import { RepositorioTalentosPostgres } from "@/server/talentos/postgres";

const repo = new RepositorioTalentosPostgres();

beforeEach(() => {
  estado.chamadas = [];
  estado.resposta = { data: null, error: null };
});

describe("talentos no Postgres", () => {
  it("salvar repetido não é erro: upsert que ignora a duplicata", async () => {
    await repo.salvar("e1", "p1");
    const upsert = estado.chamadas.find((c) => c.metodo === "upsert");
    expect(upsert?.args).toEqual([
      { empresa_id: "e1", candidato_id: "p1" },
      { onConflict: "empresa_id,candidato_id", ignoreDuplicates: true },
    ]);
  });

  it("remover filtra pela empresa e pela pessoa", async () => {
    await repo.remover("e1", "p1");
    expect(
      estado.chamadas.filter((c) => c.metodo === "eq").map((c) => c.args),
    ).toEqual([
      ["empresa_id", "e1"],
      ["candidato_id", "p1"],
    ]);
  });

  it("salvosDa devolve os ids", async () => {
    estado.resposta = {
      data: [{ candidato_id: "p1" }, { candidato_id: "p2" }],
      error: null,
    };
    expect([...(await repo.salvosDa("e1"))]).toEqual(["p1", "p2"]);
  });

  it("falha do banco vira indisponível", async () => {
    estado.resposta = { data: null, error: { message: "fora" } };
    await expect(repo.salvar("e1", "p1")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    await expect(repo.remover("e1", "p1")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    await expect(repo.salvosDa("e1")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
