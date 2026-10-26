/**
 * @vitest-environment node
 *
 * Os custos mensais no Postgres (#473): o que vai ao banco e o que volta.
 * A tabela de verdade roda em `schema.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: { metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };

function construtor() {
  const builder: Record<string, unknown> = {
    single: async () => resposta,
    maybeSingle: async () => resposta,
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta).then(resolver),
  };
  for (const metodo of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "order",
    "limit",
  ]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ metodo, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({
    from: (tabela: string) => {
      chamadas.push({ metodo: "from", args: [tabela] });
      return construtor();
    },
  }),
}));

import { RepositorioCustosPostgres } from "@/server/custos/postgres";

const ID = "11111111-1111-4111-8111-111111111111";

describe("RepositorioCustosPostgres", () => {
  const repo = new RepositorioCustosPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  it("lista na ordem de cadastro, com teto, e converte o valor", async () => {
    resposta = {
      data: [
        { id: ID, nome: "Supabase Pro", valor_centavos: "13300" },
        { id: "b", nome: "Contador", valor_centavos: 30000 },
      ],
      error: null,
    };

    expect(await repo.listar()).toEqual([
      { id: ID, nome: "Supabase Pro", centavos: 13_300 },
      { id: "b", nome: "Contador", centavos: 30_000 },
    ]);
    expect(chamadas).toContainEqual({
      metodo: "from",
      args: ["custos_mensais"],
    });
    expect(chamadas).toContainEqual({
      metodo: "order",
      args: ["ordem", { ascending: true }],
    });
    expect(chamadas.some((c) => c.metodo === "limit")).toBe(true);
  });

  it("cria com o valor em centavos na coluna certa", async () => {
    resposta = {
      data: { id: ID, nome: "Aluguel", valor_centavos: 150000 },
      error: null,
    };

    expect(await repo.criar({ nome: "Aluguel", centavos: 150_000 })).toEqual({
      id: ID,
      nome: "Aluguel",
      centavos: 150_000,
    });
    expect(chamadas).toContainEqual({
      metodo: "insert",
      args: [{ nome: "Aluguel", valor_centavos: 150_000 }],
    });
  });

  it("editar o que não existe devolve null; remover, false", async () => {
    expect(await repo.atualizar(ID, { nome: "X", centavos: 1 })).toBeNull();
    resposta = { data: [], error: null };
    expect(await repo.remover(ID)).toBe(false);
  });

  it("remover o que existe devolve true, filtrando pelo id", async () => {
    resposta = { data: [{ id: ID }], error: null };
    expect(await repo.remover(ID)).toBe(true);
    expect(chamadas).toContainEqual({ metodo: "eq", args: ["id", ID] });
  });

  it("erro do banco vira indisponível", async () => {
    resposta = { data: null, error: { message: "caiu" } };
    await expect(repo.listar()).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    await expect(repo.criar({ nome: "X", centavos: 1 })).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
