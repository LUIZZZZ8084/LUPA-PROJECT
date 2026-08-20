/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string } | null;
  count?: number;
}

const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = [];
let resposta: Resposta = { data: null, error: null };

function construtor(tabela: string) {
  const builder: Record<string, unknown> = {
    maybeSingle: async () => resposta,
    single: async () => resposta,
    then: (resolver: (v: Resposta) => unknown) =>
      Promise.resolve(resposta).then(resolver),
  };

  for (const metodo of ["select", "eq", "insert", "update", "order"]) {
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

import { RepositorioPublicacoesPostgres } from "@/server/publicacoes/postgres";

const LINHA = {
  id: "22222222-2222-4222-8222-000000000001",
  autor_id: "11111111-1111-4111-8111-000000000001",
  titulo: "Instalação concluída",
  corpo: "Quadro novo instalado no Jardim Botânico.",
  imagem_url: null,
  status: "ativa",
  criado_em: "2026-08-20T00:00:00.000Z",
  atualizado_em: "2026-08-20T00:00:00.000Z",
};

describe("RepositorioPublicacoesPostgres", () => {
  const repo = new RepositorioPublicacoesPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
  });

  it("traduz as colunas para os campos da aplicação", async () => {
    resposta = { data: LINHA, error: null };

    expect(await repo.porId(LINHA.id)).toEqual({
      id: LINHA.id,
      autorId: LINHA.autor_id,
      titulo: LINHA.titulo,
      corpo: LINHA.corpo,
      imagemUrl: null,
      status: "ativa",
      criadoEm: LINHA.criado_em,
      atualizadoEm: LINHA.atualizado_em,
    });
  });

  it("lista por autor, mais recente primeiro", async () => {
    resposta = { data: [LINHA], error: null };
    await repo.porAutor(LINHA.autor_id);

    const order = chamadas.find((c) => c.metodo === "order");
    expect(order?.args[0]).toBe("criado_em");
    expect(order?.args[1]).toMatchObject({ ascending: false });
  });

  it("filtra por status quando pedido", async () => {
    resposta = { data: [], error: null };
    await repo.porAutor(LINHA.autor_id, "arquivada");

    const eqs = chamadas
      .filter((c) => c.metodo === "eq")
      .flatMap((c) => c.args);
    expect(eqs).toContain("arquivada");
  });

  it("conta ativas sem trazer as linhas", async () => {
    resposta = { data: null, error: null, count: 7 };
    expect(await repo.contarAtivas(LINHA.autor_id)).toBe(7);

    const select = chamadas.find((c) => c.metodo === "select");
    expect(select?.args[1]).toMatchObject({ head: true, count: "exact" });
  });

  /**
   * O limite é imposto pelo trigger no Postgres — é o único lugar onde duas
   * requisições simultâneas não conseguem criar a décima primeira. A
   * tradução aqui faz a recusa chegar ao serviço na mesma forma que vem do
   * repositório em memória.
   */
  it("violação do trigger vira o mesmo erro da memória", async () => {
    resposta = {
      data: null,
      error: { message: "limite de 10 publicações ativas atingido" },
    };

    await expect(
      repo.criar({ autorId: LINHA.autor_id, titulo: "t", corpo: "c" }),
    ).rejects.toThrow("limite de publicações ativas atingido");
  });

  it("outro erro do banco vira indisponível", async () => {
    resposta = { data: null, error: { message: "conexão recusada" } };

    await expect(repo.porId("x")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  it("atualiza só os campos informados", async () => {
    resposta = { data: LINHA, error: null };
    await repo.atualizar(LINHA.id, { titulo: "Novo" });

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ titulo: "Novo" });
  });

  it("imagemUrl nula é gravada, e não ignorada", async () => {
    resposta = { data: LINHA, error: null };
    await repo.atualizar(LINHA.id, { imagemUrl: null });

    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ imagem_url: null });
  });

  it("definirStatus escreve a coluna status", async () => {
    resposta = { data: { ...LINHA, status: "arquivada" }, error: null };
    const p = await repo.definirStatus(LINHA.id, "arquivada");

    expect(p.status).toBe("arquivada");
    const update = chamadas.find((c) => c.metodo === "update");
    expect(update?.args[0]).toEqual({ status: "arquivada" });
  });
});
