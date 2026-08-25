/**
 * @vitest-environment node
 *
 * O repositório Postgres das visualizações. O que interessa aqui não é a
 * soma — isso o teste em memória já cobre — e sim *como* ele fala com o
 * banco: pela função `registrar_visualizacao`, restrito às vagas da empresa
 * e sem consultar `in` com lista vazia.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
const rpcs: { nome: string; args: unknown }[] = [];

/** Resposta por tabela; o que não estiver aqui devolve lista vazia. */
let respostas: Record<string, Resposta> = {};

function construtor(tabela: string) {
  const resposta = () => respostas[tabela] ?? { data: [], error: null };

  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta(),
    single: async () => resposta(),
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta()).then(resolver),
  };

  for (const metodo of ["select", "eq", "in", "gte", "order"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }

  return builder;
}

let erroDoRpc: { message: string } | null = null;

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

import { ehAppError } from "@/server/errors";
import { RepositorioVisualizacoesPostgres } from "@/server/visualizacoes/postgres";

const EMPRESA = "11111111-1111-4111-8111-000000000001";
const VAGA_A = "22222222-2222-4222-8222-00000000000a";
const VAGA_B = "22222222-2222-4222-8222-00000000000b";

const hoje = () => new Date().toISOString().slice(0, 10);

describe("RepositorioVisualizacoesPostgres", () => {
  const repo = new RepositorioVisualizacoesPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    rpcs.length = 0;
    respostas = {};
    erroDoRpc = null;
  });

  it("incrementa pela função, não por ler-somar-gravar", async () => {
    await repo.registrar(VAGA_A);

    expect(rpcs).toEqual([
      { nome: "registrar_visualizacao", args: { p_vaga_id: VAGA_A } },
    ]);
    // Nenhum select na tabela: a soma é do banco, senão duas visitas
    // simultâneas perderiam uma contagem.
    expect(chamadas).toEqual([]);
  });

  it("erro do banco vira AppError, não exceção crua", async () => {
    erroDoRpc = { message: "relation does not exist" };

    await expect(repo.registrar(VAGA_A)).rejects.toSatisfy(ehAppError);
  });

  it("empresa sem vaga não consulta com lista vazia", async () => {
    respostas.vagas = { data: [], error: null };

    const serie = await repo.serieDaEmpresa(EMPRESA, 7);

    expect(serie).toHaveLength(7);
    expect(serie.every((p) => p.visualizacoes === 0)).toBe(true);
    expect(chamadas.some((c) => c.metodo === "in")).toBe(false);
  });

  it("restringe as duas consultas às vagas da empresa", async () => {
    respostas.vagas = { data: [{ id: VAGA_A }, { id: VAGA_B }], error: null };

    await repo.serieDaEmpresa(EMPRESA, 30);

    const filtrosIn = chamadas.filter((c) => c.metodo === "in");
    expect(filtrosIn.map((c) => c.tabela).sort()).toEqual([
      "candidaturas",
      "visualizacoes_vaga",
    ]);
    for (const filtro of filtrosIn) {
      expect(filtro.args).toEqual(["vaga_id", [VAGA_A, VAGA_B]]);
    }
  });

  it("soma as vagas da empresa no mesmo dia da série", async () => {
    const dia = hoje();
    respostas.vagas = { data: [{ id: VAGA_A }, { id: VAGA_B }], error: null };
    respostas.visualizacoes_vaga = {
      data: [
        { dia, total: 3 },
        { dia, total: 4 },
      ],
      error: null,
    };
    respostas.candidaturas = {
      data: [{ criado_em: `${dia}T09:00:00.000Z` }],
      error: null,
    };

    const serie = await repo.serieDaEmpresa(EMPRESA, 30);
    const ponto = serie.find((p) => p.dia === dia);

    expect(ponto).toEqual({ dia, visualizacoes: 7, candidaturas: 1 });
  });

  it("falha na consulta de vagas não vira série zerada", async () => {
    respostas.vagas = { data: null, error: { message: "timeout" } };

    await expect(repo.serieDaEmpresa(EMPRESA, 30)).rejects.toSatisfy(
      ehAppError,
    );
  });
});
