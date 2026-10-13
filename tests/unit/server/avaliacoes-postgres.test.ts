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
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("avaliar, com banco", () => {
  it("quem não tem perfil de prestador não recebe avaliação", async () => {
    respostas.perfis_prestador = { data: null, error: null };

    await expect(
      avaliarPrestador(ana, { prestadorId: PRESTADOR, nota: 1 }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
    expect(inseriu()).toBe(false);
  });

  it("id sem forma de UUID é o mesmo 'não encontrado'", async () => {
    respostas.perfis_prestador = {
      data: null,
      error: { message: "invalid input syntax for type uuid", code: "22P02" },
    };

    await expect(
      avaliarPrestador(ana, { prestadorId: "nao-e-uuid", nota: 1 }),
    ).rejects.toSatisfy((e) => codigo(e) === "nao_encontrado");
    expect(inseriu()).toBe(false);
  });

  it("banco fora do ar é indisponível, não 'não encontrado'", async () => {
    respostas.perfis_prestador = { data: null, error: { message: "caiu" } };

    await expect(
      avaliarPrestador(ana, { prestadorId: PRESTADOR, nota: 5 }),
    ).rejects.toSatisfy((e) => codigo(e) === "indisponivel");
    expect(inseriu()).toBe(false);
  });

  it("prestador de verdade é avaliado", async () => {
    respostas.perfis_prestador = {
      data: { usuario_id: PRESTADOR },
      error: null,
    };

    await avaliarPrestador(ana, {
      prestadorId: PRESTADOR,
      nota: 5,
      comentario: "  Chegou na hora.  ",
    });

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
});
