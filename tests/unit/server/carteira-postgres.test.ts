/**
 * @vitest-environment node
 *
 * A carteira contra Postgres.
 *
 * O que se prova aqui é que as três operações passam pelas **funções do
 * banco**, e não por "lê, decide, grava" na aplicação. A diferença não
 * aparece em teste de caminho feliz e aparece em produção: duas cobranças
 * aprovadas quase juntas creditariam o mesmo total, e duas publicações
 * simultâneas com um crédito só passariam as duas.
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
  };
  for (const metodo of ["select", "eq"]) {
    builder[metodo] = (...args: unknown[]) => {
      chamadas.push({ metodo, args });
      return builder;
    };
  }
  return builder;
}

const estado = vi.hoisted(() => ({ temChave: true }));

vi.mock("@/lib/supabase/service", () => ({
  clienteDeServico: () =>
    estado.temChave
      ? {
          from: () => construtor(),
          rpc: (funcao: string, args: unknown) => {
            chamadas.push({ metodo: `rpc:${funcao}`, args: [args] });
            return Promise.resolve(resposta);
          },
        }
      : null,
}));

import { RepositorioCarteirasPostgres } from "@/server/carteiras/postgres";

const LINHA = {
  usuario_id: "11111111-1111-4111-8111-000000000001",
  creditos_vaga: 4,
  mensalidade_valida_ate: null,
  criado_em: "2026-09-09T00:00:00.000Z",
  atualizado_em: "2026-09-09T00:00:00.000Z",
};

describe("RepositorioCarteirasPostgres", () => {
  const repo = new RepositorioCarteirasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [LINHA], error: null };
    estado.temChave = true;
  });

  it("traduz as colunas para os campos da aplicação", async () => {
    resposta = { data: LINHA, error: null };

    expect(await repo.porUsuario(LINHA.usuario_id)).toEqual({
      usuarioId: LINHA.usuario_id,
      creditosVaga: 4,
      mensalidadeValidaAte: null,
      criadoEm: LINHA.criado_em,
      atualizadoEm: LINHA.atualizado_em,
    });
  });

  it("quem nunca comprou nada não tem carteira", async () => {
    resposta = { data: null, error: null };
    expect(await repo.porUsuario(LINHA.usuario_id)).toBeNull();
  });

  it("creditar soma pela função do banco, não por leitura anterior", async () => {
    await repo.creditar(LINHA.usuario_id, 5);

    const rpc = chamadas.find((c) => c.metodo === "rpc:creditar_vaga");
    expect(rpc?.args[0]).toEqual({
      p_usuario: LINHA.usuario_id,
      p_quantidade: 5,
    });
    // Nenhuma leitura antes: a soma é a própria instrução.
    expect(chamadas.some((c) => c.metodo === "select")).toBe(false);
  });

  /** Debitar é creditar com sinal trocado — a mesma função, e o mesmo `greatest(0, …)`. */
  it("debitar passa quantidade negativa", async () => {
    await repo.debitar(LINHA.usuario_id, 3);

    const rpc = chamadas.find((c) => c.metodo === "rpc:creditar_vaga");
    expect(rpc?.args[0]).toEqual({
      p_usuario: LINHA.usuario_id,
      p_quantidade: -3,
    });
  });

  /**
   * Zero linhas é a resposta esperada quando não havia crédito — a guarda
   * mora no `where` da função, e quem chama lê `null` como recusa.
   */
  it("consumir devolve null quando a função não muda linha nenhuma", async () => {
    resposta = { data: [], error: null };
    expect(await repo.consumirCredito(LINHA.usuario_id)).toBeNull();
  });

  it("consumir devolve a carteira quando havia crédito", async () => {
    resposta = { data: [{ ...LINHA, creditos_vaga: 3 }], error: null };

    const carteira = await repo.consumirCredito(LINHA.usuario_id);

    expect(carteira?.creditosVaga).toBe(3);
    expect(chamadas.some((c) => c.metodo === "rpc:consumir_credito_vaga")).toBe(
      true,
    );
  });

  it("estender manda os dias; revogar manda nulo", async () => {
    await repo.estenderMensalidade(LINHA.usuario_id, 30);
    await repo.revogarMensalidade(LINHA.usuario_id);

    const chamadasRpc = chamadas
      .filter((c) => c.metodo === "rpc:estender_mensalidade_vaga")
      .map((c) => c.args[0]);

    expect(chamadasRpc).toEqual([
      { p_usuario: LINHA.usuario_id, p_dias: 30 },
      { p_usuario: LINHA.usuario_id, p_dias: null },
    ]);
  });

  it("erro do banco vira 'indisponível'", async () => {
    resposta = { data: null, error: { message: "conexão caiu" } };

    await expect(repo.porUsuario(LINHA.usuario_id)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    await expect(repo.creditar(LINHA.usuario_id, 1)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    await expect(repo.consumirCredito(LINHA.usuario_id)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  /**
   * Uma função que responde sem devolver linha nenhuma é erro de
   * servidor, não "nada a fazer": `creditar` e `estender` sempre criam a
   * carteira se ela não existir, então zero linhas ali quer dizer que a
   * função mudou e ninguém percebeu.
   */
  it("creditar sem linha de volta falha alto, em vez de fingir que deu certo", async () => {
    resposta = { data: [], error: null };

    await expect(repo.creditar(LINHA.usuario_id, 1)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  it("sem chave de serviço configurada, recusa com 'indisponível'", async () => {
    estado.temChave = false;
    try {
      await expect(repo.porUsuario(LINHA.usuario_id)).rejects.toMatchObject({
        codigo: "indisponivel",
      });
    } finally {
      estado.temChave = true;
    }
  });
});
