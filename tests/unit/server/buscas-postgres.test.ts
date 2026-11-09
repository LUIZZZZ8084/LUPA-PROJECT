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
  // `limit` entrou com o teto das listagens (#203). Sem ele no duble, a
  // cadeia quebra e o teste reprova por falta de espelho, não por defeito
  // — falso vermelho é o que ensina a ignorar teste.
  for (const metodo of ["select", "eq", "gte", "order", "limit"]) {
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

  /**
   * O ranking vem somado e ordenado da view (#585): o teto corta o
   * resultado, e não a entrada da soma, como fazia a leitura da tabela.
   */
  it("lê a view somada, ordenada pelo mais buscado, com o limite pedido", async () => {
    resposta = {
      data: [
        { termo: "soldador", total: 5 },
        { termo: "costureira", total: 4 },
      ],
      error: null,
    };

    expect(await repo.maisBuscados(30, 20)).toEqual([
      { termo: "soldador", total: 5 },
      { termo: "costureira", total: 4 },
    ]);
    expect(chamadas[0].tabela).toBe("metricas_buscas_sem_resultado");
    const ordem = chamadas.filter((c) => c.metodo === "order");
    expect(ordem[0].args).toEqual(["total", { ascending: false }]);
    expect(chamadas.find((c) => c.metodo === "limit")?.args[0]).toBe(20);
  });

  it("falha na consulta não vira lista vazia", async () => {
    resposta = { data: null, error: { message: "timeout" } };
    await expect(repo.maisBuscados(30, 20)).rejects.toSatisfy(ehAppError);
  });
});
