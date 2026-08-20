/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
const respostas = new Map<string, Resposta>();

function construtor(tabela: string) {
  const resposta = () => respostas.get(tabela) ?? { data: null, error: null };

  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta(),
    single: async () => resposta(),
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta()).then(resolver),
  };

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
  clienteDeServico: () => ({ from: (tabela: string) => construtor(tabela) }),
}));

import { RepositorioMetricasPostgres } from "@/server/metrics/postgres";

describe("RepositorioMetricasPostgres", () => {
  const repo = new RepositorioMetricasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    respostas.clear();
  });

  it("lê os totais da view e converte para número", async () => {
    respostas.set("metricas_totais", {
      // O Postgres devolve count como string em algumas rotas do PostgREST.
      data: {
        usuarios: "42",
        candidatos: "20",
        prestadores: "15",
        empresas: "7",
        vagas_abertas: "9",
      },
      error: null,
    });

    expect(await repo.totais()).toEqual({
      usuarios: 42,
      candidatos: 20,
      prestadores: 15,
      empresas: 7,
      vagasAbertas: 9,
    });
  });

  it("view vazia devolve zeros, não NaN", async () => {
    respostas.set("metricas_totais", { data: null, error: null });

    const totais = await repo.totais();
    expect(Object.values(totais).every((v) => v === 0)).toBe(true);
  });

  /**
   * Dia sem cadastro precisa aparecer como zero. Se a série pular os vazios,
   * o gráfico mente sobre a constância do crescimento.
   */
  it("monta a série contínua a partir das linhas da view", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    respostas.set("metricas_cadastros_por_dia", {
      data: [{ dia: hoje, papel: "candidato_clt", total: 3 }],
      error: null,
    });

    const serie = await repo.cadastrosPorDia(7);

    expect(serie).toHaveLength(7);
    expect(serie.at(-1)?.dia).toBe(hoje);
    expect(serie.at(-1)?.total).toBe(3);
    expect(serie.at(-1)?.porPapel.candidato_clt).toBe(3);
    expect(serie[0].total).toBe(0);
  });

  it("soma os papéis do mesmo dia", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    respostas.set("metricas_cadastros_por_dia", {
      data: [
        { dia: hoje, papel: "candidato_clt", total: 3 },
        { dia: hoje, papel: "empresa", total: 2 },
      ],
      error: null,
    });

    const serie = await repo.cadastrosPorDia(7);
    expect(serie.at(-1)?.total).toBe(5);
    expect(serie.at(-1)?.porPapel.empresa).toBe(2);
  });

  it("pede só a janela solicitada", async () => {
    respostas.set("metricas_cadastros_por_dia", { data: [], error: null });
    await repo.cadastrosPorDia(7);

    const gte = chamadas.find((c) => c.metodo === "gte");
    expect(gte?.args[0]).toBe("dia");
  });

  it("locais vêm ordenados e limitados", async () => {
    respostas.set("metricas_por_local", {
      data: [
        { cidade: "Sinop", bairro: "Centro", total: "12" },
        { cidade: "Sinop", bairro: null, total: "3" },
      ],
      error: null,
    });

    const locais = await repo.distribuicaoPorLocal(10);

    expect(locais[0]).toEqual({ cidade: "Sinop", bairro: "Centro", total: 12 });
    expect(locais[1].bairro).toBeNull();

    const limit = chamadas.find((c) => c.metodo === "limit");
    expect(limit?.args[0]).toBe(10);
  });

  it("planos vêm da view de contagem", async () => {
    respostas.set("metricas_planos", {
      data: { mensal: "4", trial: "11" },
      error: null,
    });

    expect(await repo.planosDeEmpresa()).toEqual({ mensal: 4, trial: 11 });
  });

  it("erro de banco vira indisponível, não interno", async () => {
    respostas.set("metricas_totais", {
      data: null,
      error: { message: "conexão recusada" },
    });

    await expect(repo.totais()).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });
});
