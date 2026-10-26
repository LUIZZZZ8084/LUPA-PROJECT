/**
 * @vitest-environment node
 *
 * Avaliar, no caminho com banco: só se avalia quem é prestador (#439).
 *
 * A chave estrangeira de `avaliacoes.prestador_id` aponta para `usuarios`,
 * e sem esta conferência a avaliação gravada na conta de um candidato
 * passava a contar na nota dele no dia em que ele virasse prestador.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let respostas: Record<string, Resposta> = {};

function construtor(tabela: string) {
  const resposta = () => respostas[tabela] ?? { data: null, error: null };
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta(),
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta()).then(resolver),
  };
  for (const metodo of ["select", "eq", "insert"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args });
      return builder;
    };
  }
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  clienteDeServico: () => ({ from: (tabela: string) => construtor(tabela) }),
}));

/*
 * O teto por rede (#441) é conferido pelo repositório de limites, que no
 * caminho com banco chama uma função SQL. Aqui ele vira um dublê que
 * registra a chave, e `schema.test.ts` cobre a função de verdade.
 */
const consumir = vi.hoisted(() =>
  vi.fn(async (_chave: string, _orcamento: unknown) => {}),
);
vi.mock("@/server/auth/rate-limit", () => ({ consumirOrcamento: consumir }));

vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    porId: async () => ({ nomeCompleto: "Ana Paula" }),
    perfilEmpresa: async () => null,
  }),
}));

import type { Autenticado } from "@/server/auth/rbac";
import { avaliarPrestador } from "@/server/avaliacoes/servico";
import { ehAppError } from "@/server/errors";

const ana: Autenticado = { usuarioId: "ana", papel: "candidato_clt" };
const PRESTADOR = "44444444-4444-4444-8444-000000000001";
const REDE = "203.0.113.7";

function codigo(e: unknown) {
  return ehAppError(e) ? e.codigo : String(e);
}

function inseriu() {
  return chamadas.some(
    (c) => c.tabela === "avaliacoes" && c.metodo === "insert",
  );
}

beforeEach(() => {
  chamadas.length = 0;
  respostas = {};
  consumir.mockReset();
  consumir.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("avaliar, com banco", () => {
  it("quem não tem perfil de prestador não recebe avaliação", async () => {
    respostas.perfis_prestador = { data: null, error: null };

    await expect(
      avaliarPrestador(ana, { prestadorId: PRESTADOR, nota: 1 }, REDE),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
    expect(inseriu()).toBe(false);
  });

  it("id sem forma de UUID é o mesmo 'não encontrado'", async () => {
    respostas.perfis_prestador = {
      data: null,
      error: { message: "invalid input syntax for type uuid", code: "22P02" },
    };

    await expect(
      avaliarPrestador(ana, { prestadorId: "nao-e-uuid", nota: 1 }, REDE),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
    expect(inseriu()).toBe(false);
  });

  it("banco fora do ar é indisponível, não 'não encontrado'", async () => {
    respostas.perfis_prestador = { data: null, error: { message: "caiu" } };

    await expect(
      avaliarPrestador(ana, { prestadorId: PRESTADOR, nota: 5 }, REDE),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
    expect(inseriu()).toBe(false);
  });

  it("prestador de verdade é avaliado", async () => {
    respostas.perfis_prestador = {
      data: { usuario_id: PRESTADOR },
      error: null,
    };

    await avaliarPrestador(
      ana,
      {
        prestadorId: PRESTADOR,
        nota: 5,
        comentario: "  Chegou na hora.  ",
      },
      REDE,
    );

    const insert = chamadas.find(
      (c) => c.tabela === "avaliacoes" && c.metodo === "insert",
    );
    expect(insert?.args[0]).toEqual({
      prestador_id: PRESTADOR,
      avaliador_id: "ana",
      nome_avaliador: "Ana Paula",
      nota: 5,
      comentario: "Chegou na hora.",
    });
  });

  it("o teto conta por prestador e rede, depois de conferir o prestador", async () => {
    respostas.perfis_prestador = {
      data: { usuario_id: PRESTADOR },
      error: null,
    };

    await avaliarPrestador(ana, { prestadorId: PRESTADOR, nota: 4 }, REDE);

    expect(consumir).toHaveBeenCalledTimes(1);
    expect(consumir.mock.calls[0][0]).toBe(
      `avaliacao-rede:${PRESTADOR}:${REDE}`,
    );
    expect(consumir.mock.calls[0][1]).toEqual({
      chamadas: 3,
      janelaSegundos: 86400,
    });
  });

  it("quem não é prestador não gasta a cota da rede", async () => {
    respostas.perfis_prestador = { data: null, error: null };

    await avaliarPrestador(
      ana,
      { prestadorId: PRESTADOR, nota: 1 },
      REDE,
    ).catch(() => undefined);

    expect(consumir).not.toHaveBeenCalled();
  });

  it("teto atingido vira mensagem de amanhã, e nada é gravado", async () => {
    respostas.perfis_prestador = {
      data: { usuario_id: PRESTADOR },
      error: null,
    };
    const { erros } = await import("@/server/errors");
    consumir.mockRejectedValueOnce(erros.muitasTentativas(80000));

    const erro = await avaliarPrestador(
      ana,
      { prestadorId: PRESTADOR, nota: 1 },
      REDE,
    ).catch((e) => e);

    expect(codigo(erro)).toBe("limite_excedido");
    expect(ehAppError(erro) && erro.mensagem).not.toMatch(/80000/);
    expect(inseriu()).toBe(false);
  });

  it("outro erro do limite sobe como veio", async () => {
    respostas.perfis_prestador = {
      data: { usuario_id: PRESTADOR },
      error: null,
    };
    const { erros } = await import("@/server/errors");
    consumir.mockRejectedValueOnce(erros.indisponivel("limite fora"));

    await expect(
      avaliarPrestador(ana, { prestadorId: PRESTADOR, nota: 1 }, REDE),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
  });
});
