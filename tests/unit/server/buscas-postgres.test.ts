/**
 * @vitest-environment node
 *
 * O repositório Postgres das buscas sem resultado.
 *
 * O que interessa aqui é *como* ele fala com o banco: pela função, com o
 * termo já normalizado, e somando os dias da janela em memória em vez de
 * pedir agregação ao PostgREST.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
const rpcs: { nome: string; args: unknown }[] = [];
let resposta: Resposta = { data: [], error: null };
let erroDoRpc: { message: string } | null = null;

function construtor(tabela: string) {
  const builder: Record<string, unknown> = {
    then: (r: (v: Resposta) => unknown) => Promise.resolve(resposta).then(r),
  };
  for (const metodo of ["select", "eq", "gte"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  temChaveDeServico: true,
  clienteDeServico: () => ({
    from: (tabela: string) => construtor(tabela),
    rpc: async (nome: string, args: unknown) => {
      rpcs.push({ nome, args });
      return { data: null, error: erroDoRpc };
    },
  }),
}));

import { RepositorioBuscasPostgres } from "@/server/buscas/postgres";
import { ehAppError } from "@/server/errors";

describe("RepositorioBuscasPostgres", () => {
  const repo = new RepositorioBuscasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    rpcs.length = 0;
    resposta = { data: [], error: null };
    erroDoRpc = null;
  });

  it("registra pela função, com termo e tela", async () => {
    await repo.registrar("eletricista", "servicos");

    expect(rpcs).toEqual([
      {
        nome: "registrar_busca_sem_resultado",
        args: { p_termo: "eletricista", p_onde: "servicos" },
      },
    ]);
    // A soma é do banco: nenhum select no caminho do incremento.
    expect(chamadas).toEqual([]);
  });

  it("erro do banco vira AppError, não exceção crua", async () => {
    erroDoRpc = { message: "relation does not exist" };
    await expect(repo.registrar("x", "vagas")).rejects.toSatisfy(ehAppError);
  });

  it("a leitura recorta pela janela pedida", async () => {
    await repo.maisBuscados(30, 20);

    const gte = chamadas.find((c) => c.metodo === "gte");
    expect(gte?.args[0]).toBe("dia");
    // 30 dias atrás, no formato do `date` do Postgres.
    expect(String(gte?.args[1])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("soma os dias do mesmo termo e ordena pelo mais buscado", async () => {
    resposta = {
      data: [
        { termo: "soldador", total: 2 },
        { termo: "costureira", total: 4 },
        { termo: "soldador", total: 3 },
      ],
      error: null,
    };

    expect(await repo.maisBuscados(30, 20)).toEqual([
      { termo: "soldador", total: 5 },
      { termo: "costureira", total: 4 },
    ]);
  });

  it("respeita o limite pedido", async () => {
    resposta = {
      data: Array.from({ length: 30 }, (_, i) => ({
        termo: `t${i}`,
        total: 1,
      })),
      error: null,
    };

    expect(await repo.maisBuscados(30, 5)).toHaveLength(5);
  });

  it("falha na consulta não vira lista vazia", async () => {
    resposta = { data: null, error: { message: "timeout" } };
    await expect(repo.maisBuscados(30, 20)).rejects.toSatisfy(ehAppError);
  });
});
