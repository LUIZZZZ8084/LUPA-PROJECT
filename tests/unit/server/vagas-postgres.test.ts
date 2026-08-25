/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
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

const estado = vi.hoisted(() => ({ temChave: true }));

vi.mock("@/lib/supabase/service", () => ({
  get temChaveDeServico() {
    return estado.temChave;
  },
  clienteDeServico: () =>
    estado.temChave ? { from: (tabela: string) => construtor(tabela) } : null,
}));

import { RepositorioVagasPostgres } from "@/server/vagas/postgres";

const LINHA = {
  id: "22222222-2222-4222-8222-000000000001",
  empresa_id: "11111111-1111-4111-8111-000000000001",
  titulo: "Operador de Máquinas",
  descricao: "Operação de colheitadeira.",
  categoria: "Agronegócio",
  cidade: "Sinop",
  bairro: null,
  tipo_contrato: "CLT",
  salario_min: null,
  salario_max: null,
  status: "aberta",
  criado_em: "2026-08-20T00:00:00.000Z",
};

describe("RepositorioVagasPostgres", () => {
  const repo = new RepositorioVagasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
    estado.temChave = true;
  });

  it("traduz as colunas para os campos da aplicação", async () => {
    resposta = { data: LINHA, error: null };
    const vaga = await repo.porId(LINHA.id);

    expect(vaga).toEqual({
      id: LINHA.id,
      empresaId: LINHA.empresa_id,
      titulo: LINHA.titulo,
      descricao: LINHA.descricao,
      categoria: LINHA.categoria,
      cidade: LINHA.cidade,
      bairro: null,
      tipoContrato: LINHA.tipo_contrato,
      salarioMin: null,
      salarioMax: null,
      status: "aberta",
      criadoEm: LINHA.criado_em,
    });
  });

  it("id sem forma de uuid é 'não encontrado', não erro de servidor", async () => {
    resposta = {
      data: null,
      error: { message: "invalid input", code: "22P02" },
    };
    expect(await repo.porId("nao-e-uuid")).toBeNull();
  });

  it("criar grava em português", async () => {
    resposta = { data: LINHA, error: null };
    await repo.criar({
      empresaId: LINHA.empresa_id,
      titulo: LINHA.titulo,
      descricao: LINHA.descricao,
      categoria: LINHA.categoria,
      cidade: LINHA.cidade,
      tipoContrato: LINHA.tipo_contrato,
    });

    const insercao = chamadas.find((c) => c.metodo === "insert");
    expect(insercao?.args[0]).toMatchObject({
      empresa_id: LINHA.empresa_id,
      tipo_contrato: LINHA.tipo_contrato,
    });
  });

  it("empresa sem perfil ainda vira conflito, não erro genérico", async () => {
    resposta = {
      data: null,
      error: { message: "fk violation", code: "23503" },
    };
    await expect(
      repo.criar({
        empresaId: "sem-perfil",
        titulo: LINHA.titulo,
        descricao: LINHA.descricao,
        categoria: LINHA.categoria,
        cidade: LINHA.cidade,
        tipoContrato: LINHA.tipo_contrato,
      }),
    ).rejects.toMatchObject({ codigo: "conflito" });
  });

  it("encerrar muda o status para fechada", async () => {
    resposta = { data: { ...LINHA, status: "fechada" }, error: null };
    const vaga = await repo.encerrar(LINHA.id);

    expect(vaga.status).toBe("fechada");
    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.args[0]).toEqual({ status: "fechada" });
  });

  it("atualizar só envia os campos informados", async () => {
    resposta = { data: LINHA, error: null };
    await repo.atualizar(LINHA.id, { titulo: "Novo título" });

    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.args[0]).toEqual({ titulo: "Novo título" });
  });

  it("atualizar vaga inexistente é 'não encontrado'", async () => {
    resposta = { data: null, error: { message: "no rows", code: "PGRST116" } };
    await expect(
      repo.atualizar(LINHA.id, { titulo: "x" }),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("encerrar vaga inexistente é 'não encontrado'", async () => {
    resposta = { data: null, error: { message: "no rows", code: "PGRST116" } };
    await expect(repo.encerrar("nao-existe")).rejects.toMatchObject({
      codigo: "nao_encontrado",
    });
  });

  it("erro sem código conhecido vira 'indisponível'", async () => {
    resposta = { data: null, error: { message: "conexão caiu" } };
    await expect(repo.encerrar(LINHA.id)).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  it("porEmpresa lista as vagas da empresa", async () => {
    resposta = { data: [LINHA], error: null };
    const vagas = await repo.porEmpresa(LINHA.empresa_id);

    expect(vagas).toHaveLength(1);
    expect(vagas[0].empresaId).toBe(LINHA.empresa_id);
  });

  it("porEmpresa com id inválido devolve lista vazia", async () => {
    resposta = { data: null, error: { message: "invalid", code: "22P02" } };
    expect(await repo.porEmpresa("nao-e-uuid")).toEqual([]);
  });

  it("listar devolve todas as vagas", async () => {
    resposta = { data: [LINHA], error: null };
    expect(await repo.listar()).toHaveLength(1);
  });

  it("listar sem linhas devolve lista vazia", async () => {
    resposta = { data: null, error: null };
    expect(await repo.listar()).toEqual([]);
  });

  it("sem chave de serviço configurada, recusa com 'indisponível'", async () => {
    estado.temChave = false;
    try {
      await expect(repo.listar()).rejects.toMatchObject({
        codigo: "indisponivel",
      });
    } finally {
      /*
       * Restaura mesmo se a asserção falhar. Sem isto, todo teste que
       * rodasse depois herdava "sem chave" e falhava por um motivo que não
       * era o dele — o tipo de rastro que faz procurar defeito no lugar
       * errado.
       */
      estado.temChave = true;
    }
  });
});

/**
 * Caminhos de queda.
 *
 * Cada leitura tem dois desvios antes de virar exceção: id sem forma de
 * uuid, que é ausência, e falha de banco, que é incidente. Trocar um pelo
 * outro tem custo dos dois lados — link velho de crawler acordando alguém
 * de madrugada, ou banco fora do ar aparecendo como "não encontrado" e
 * ninguém sendo avisado.
 */
describe("quando a consulta falha", () => {
  const repo = new RepositorioVagasPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: null, error: null };
  });

  const QUEDA = { message: "conexão recusada", code: "08006" };
  const ID_TORTO = {
    message: "invalid input syntax for type uuid",
    code: "22P02",
  };

  it.each([
    ["porId", () => repo.porId("x")],
    ["porEmpresa", () => repo.porEmpresa("x")],
    ["listar", () => repo.listar()],
  ])("%s com banco fora do ar vira indisponível", async (_n, chamar) => {
    resposta = { data: null, error: QUEDA };
    await expect(chamar()).rejects.toMatchObject({ codigo: "indisponivel" });
  });

  it.each([
    ["atualizar", () => repo.atualizar("x", { titulo: "Novo" })],
    ["encerrar", () => repo.encerrar("x")],
  ])("%s com banco fora do ar não vira não-encontrado", async (_n, chamar) => {
    resposta = { data: null, error: QUEDA };
    await expect(chamar()).rejects.toMatchObject({ codigo: "indisponivel" });
  });

  it.each([
    ["atualizar", () => repo.atualizar("abc", { titulo: "Novo" })],
    ["encerrar", () => repo.encerrar("abc")],
  ])("%s com id torto é não-encontrado", async (_n, chamar) => {
    resposta = { data: null, error: ID_TORTO };
    await expect(chamar()).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("porEmpresa sem linhas devolve lista vazia, não null", async () => {
    resposta = { data: null, error: null };
    expect(await repo.porEmpresa("x")).toEqual([]);
  });

  it("porId sem resultado devolve null", async () => {
    resposta = { data: null, error: null };
    expect(await repo.porId("x")).toBeNull();
  });
});
