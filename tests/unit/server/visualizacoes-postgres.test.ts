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

  // `limit` entrou com o teto das listagens (#203). Sem ele no duble, a
  // cadeia quebra e o teste reprova por falta de espelho, não por defeito
  // — falso vermelho é o que ensina a ignorar teste.
  for (const metodo of ["select", "eq", "in", "gte", "order", "limit"]) {
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

  /*
   * O total por vaga (#492) é somado aqui, como a série: o PostgREST não
   * agrupa sem uma view por recorte.
   */
  describe("totaisPorVaga", () => {
    it("soma os dias de cada vaga, separadas por id", async () => {
      respostas.vagas = { data: [{ id: VAGA_A }, { id: VAGA_B }], error: null };
      respostas.visualizacoes_vaga = {
        data: [
          { vaga_id: VAGA_A, total: 3 },
          { vaga_id: VAGA_A, total: 4 },
          { vaga_id: VAGA_B, total: 5 },
        ],
        error: null,
      };

      const totais = await repo.totaisPorVaga(EMPRESA);

      expect(totais.get(VAGA_A)).toBe(7);
      expect(totais.get(VAGA_B)).toBe(5);
    });

    it("restringe às vagas da empresa", async () => {
      respostas.vagas = { data: [{ id: VAGA_A }], error: null };

      await repo.totaisPorVaga(EMPRESA);

      const filtro = chamadas.find(
        (c) => c.tabela === "visualizacoes_vaga" && c.metodo === "in",
      );
      expect(filtro?.args).toEqual(["vaga_id", [VAGA_A]]);
    });

    it("empresa sem vaga não consulta com lista vazia", async () => {
      respostas.vagas = { data: [], error: null };

      expect((await repo.totaisPorVaga(EMPRESA)).size).toBe(0);
      expect(chamadas.some((c) => c.metodo === "in")).toBe(false);
    });

    it("falha do banco não vira zero", async () => {
      respostas.vagas = { data: [{ id: VAGA_A }], error: null };
      respostas.visualizacoes_vaga = {
        data: null,
        error: { message: "caiu" },
      };

      await expect(repo.totaisPorVaga(EMPRESA)).rejects.toSatisfy(ehAppError);
    });
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
