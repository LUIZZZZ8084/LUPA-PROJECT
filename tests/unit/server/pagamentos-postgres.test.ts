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

  for (const metodo of ["select", "eq", "insert", "update"]) {
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

import { RepositorioPagamentosPostgres } from "@/server/pagamentos/postgres";

const LINHA = {
  id: "22222222-2222-4222-8222-000000000001",
  usuario_id: "11111111-1111-4111-8111-000000000001",
  tipo: "prestador_mensalidade",
  valor_centavos: 2490,
  status: "pendente",
  mp_preference_id: null,
  mp_payment_id: null,
  metadata: {},
  criado_em: "2026-08-20T00:00:00.000Z",
  atualizado_em: "2026-08-20T00:00:00.000Z",
};

describe("RepositorioPagamentosPostgres", () => {
  const repo = new RepositorioPagamentosPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null };
    estado.temChave = true;
  });

  it("traduz as colunas para os campos da aplicação", async () => {
    resposta = { data: LINHA, error: null };
    const pagamento = await repo.porId(LINHA.id);

    expect(pagamento).toEqual({
      id: LINHA.id,
      usuarioId: LINHA.usuario_id,
      tipo: "prestador_mensalidade",
      valorCentavos: 2490,
      status: "pendente",
      mpPreferenceId: null,
      mpPaymentId: null,
      metadata: {},
      criadoEm: LINHA.criado_em,
      atualizadoEm: LINHA.atualizado_em,
    });
  });

  it("id sem forma de uuid é 'não encontrado', não erro de servidor", async () => {
    resposta = {
      data: null,
      error: { message: "invalid input", code: "22P02" },
    };
    expect(await repo.porId("nao-e-uuid")).toBeNull();
  });

  it("criar grava tipo, valor e metadata", async () => {
    resposta = { data: LINHA, error: null };
    await repo.criar({
      usuarioId: LINHA.usuario_id,
      tipo: "prestador_mensalidade",
      valorCentavos: 2490,
      metadata: { origem: "teste" },
    });

    const insercao = chamadas.find((c) => c.metodo === "insert");
    expect(insercao?.args[0]).toEqual({
      usuario_id: LINHA.usuario_id,
      tipo: "prestador_mensalidade",
      valor_centavos: 2490,
      metadata: { origem: "teste" },
    });
  });

  it("definirPreferencia grava o id da preferência do Mercado Pago", async () => {
    resposta = { data: { ...LINHA, mp_preference_id: "pref-1" }, error: null };
    const pagamento = await repo.definirPreferencia(LINHA.id, "pref-1");

    expect(pagamento.mpPreferenceId).toBe("pref-1");
    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.args[0]).toEqual({ mp_preference_id: "pref-1" });
  });

  it("definirPreferencia de pagamento inexistente é 'não encontrado'", async () => {
    resposta = { data: null, error: { message: "no rows", code: "PGRST116" } };
    await expect(
      repo.definirPreferencia("nao-existe", "pref-1"),
    ).rejects.toMatchObject({ codigo: "nao_encontrado" });
  });

  it("aprovar só muda o status quando ainda está pendente", async () => {
    resposta = {
      data: { ...LINHA, status: "aprovado", mp_payment_id: "mp-1" },
      error: null,
    };
    const pagamento = await repo.aprovar(LINHA.id, "mp-1");

    expect(pagamento?.status).toBe("aprovado");
    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.args[0]).toEqual({
      status: "aprovado",
      mp_payment_id: "mp-1",
    });
    // A condição `status = pendente` é o que torna a troca idempotente —
    // sem ela, dois webhooks concorrentes aplicariam o efeito duas vezes.
    const condicaoStatus = chamadas.find(
      (c) => c.metodo === "eq" && c.args[0] === "status",
    );
    expect(condicaoStatus?.args).toEqual(["status", "pendente"]);
  });

  it("aprovar devolve null quando não havia mais nada pendente", async () => {
    // Zero linhas: a condição `status = pendente` não bateu.
    resposta = { data: null, error: null };
    expect(await repo.aprovar(LINHA.id, "mp-1")).toBeNull();
  });

  it("rejeitar sem mpPaymentId não sobrescreve o que já estava gravado", async () => {
    resposta = { data: { ...LINHA, status: "rejeitado" }, error: null };
    await repo.rejeitar(LINHA.id, null);

    const atualizacao = chamadas.find((c) => c.metodo === "update");
    expect(atualizacao?.args[0]).toEqual({ status: "rejeitado" });
  });

  it("erro sem código conhecido vira 'indisponível'", async () => {
    resposta = { data: null, error: { message: "conexão caiu" } };
    await expect(repo.aprovar(LINHA.id, "mp-1")).rejects.toMatchObject({
      codigo: "indisponivel",
    });
  });

  it("sem chave de serviço configurada, recusa com 'indisponível'", async () => {
    estado.temChave = false;
    try {
      await expect(repo.porId(LINHA.id)).rejects.toMatchObject({
        codigo: "indisponivel",
      });
    } finally {
      estado.temChave = true;
    }
  });
});
