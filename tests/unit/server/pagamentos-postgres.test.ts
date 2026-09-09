/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  data: unknown;
  error: { message: string; code?: string } | null;
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

  for (const metodo of [
    "select",
    "eq",
    "neq",
    "in",
    "insert",
    "update",
    "order",
    "limit",
  ]) {
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
  mp_payment_id: null,
  assinatura_id: null,
  metadata: {},
  criado_em: "2026-08-20T00:00:00.000Z",
  atualizado_em: "2026-08-20T00:00:00.000Z",
};

const ASSINATURA = {
  id: "33333333-3333-4333-8333-000000000001",
  usuario_id: LINHA.usuario_id,
  tipo: "prestador_mensalidade",
  valor_centavos: 1990,
  status: "pendente",
  mp_preapproval_id: "pre-1",
  checkout_url: "https://mercadopago.com/subscriptions/pre-1",
  criado_em: "2026-09-09T00:00:00.000Z",
  atualizado_em: "2026-09-09T00:00:00.000Z",
};

describe("RepositorioPagamentosPostgres", () => {
  const repo = new RepositorioPagamentosPostgres();

  beforeEach(() => {
    chamadas.length = 0;
    resposta = { data: [], error: null, count: 0 };
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
      mpPaymentId: null,
      assinaturaId: null,
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
      assinatura_id: null,
      metadata: { origem: "teste" },
    });
  });

  /**
   * O índice único de `mp_payment_id` é quem torna a parcela idempotente,
   * e o `23505` é como ele se manifesta aqui. Ler antes de escrever não
   * serviria: o Mercado Pago reenvia o aviso, e duas notificações
   * chegando juntas passariam as duas pelo `select`.
   */
  it("registrarLiquidada grava a parcela já aprovada", async () => {
    resposta = {
      data: { ...LINHA, status: "aprovado", mp_payment_id: "mp-9" },
      error: null,
    };

    const parcela = await repo.registrarLiquidada({
      usuarioId: LINHA.usuario_id,
      tipo: "prestador_mensalidade",
      valorCentavos: 1990,
      assinaturaId: "ass-1",
      mpPaymentId: "mp-9",
    });

    expect(parcela?.status).toBe("aprovado");
    const insercao = chamadas.find((c) => c.metodo === "insert");
    expect(insercao?.args[0]).toMatchObject({
      status: "aprovado",
      mp_payment_id: "mp-9",
      assinatura_id: "ass-1",
    });
  });

  it("registrarLiquidada devolve null quando a parcela já estava registrada", async () => {
    resposta = {
      data: null,
      error: { message: "duplicate key", code: "23505" },
    };

    const parcela = await repo.registrarLiquidada({
      usuarioId: LINHA.usuario_id,
      tipo: "prestador_mensalidade",
      valorCentavos: 1990,
      mpPaymentId: "mp-9",
    });

    expect(parcela, "aviso repetido não é erro, é 'nada a fazer'").toBeNull();
  });

  it("definirStatusAssinatura não sai de 'cancelada' nem regrava o mesmo status", async () => {
    resposta = { data: { ...ASSINATURA, status: "ativa" }, error: null };
    await repo.definirStatusAssinatura(ASSINATURA.id, "ativa");

    const naoIguais = chamadas.filter((c) => c.metodo === "neq");
    expect(naoIguais.map((c) => c.args)).toEqual([
      ["status", "ativa"],
      ["status", "cancelada"],
    ]);
  });

  it("assinaturaViva procura só as que ainda valem alguma coisa", async () => {
    resposta = { data: ASSINATURA, error: null };
    const assinatura = await repo.assinaturaViva(LINHA.usuario_id);

    expect(assinatura?.mpPreapprovalId).toBe("pre-1");
    const filtro = chamadas.find((c) => c.metodo === "in");
    expect(filtro?.args).toEqual(["status", ["pendente", "ativa", "pausada"]]);
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

  describe("assinaturas", () => {
    it("criarAssinatura grava usuário, tipo e valor", async () => {
      resposta = { data: ASSINATURA, error: null };
      const assinatura = await repo.criarAssinatura({
        usuarioId: LINHA.usuario_id,
        tipo: "prestador_mensalidade",
        valorCentavos: 1990,
      });

      expect(assinatura.status).toBe("pendente");
      const insercao = chamadas.find((c) => c.metodo === "insert");
      expect(insercao?.args[0]).toEqual({
        usuario_id: LINHA.usuario_id,
        tipo: "prestador_mensalidade",
        valor_centavos: 1990,
      });
    });

    it("traduz as colunas da assinatura para os campos da aplicação", async () => {
      resposta = { data: ASSINATURA, error: null };
      expect(await repo.assinaturaPorId(ASSINATURA.id)).toEqual({
        id: ASSINATURA.id,
        usuarioId: ASSINATURA.usuario_id,
        tipo: "prestador_mensalidade",
        valorCentavos: 1990,
        status: "pendente",
        mpPreapprovalId: "pre-1",
        checkoutUrl: ASSINATURA.checkout_url,
        criadoEm: ASSINATURA.criado_em,
        atualizadoEm: ASSINATURA.atualizado_em,
      });
    });

    it("id sem forma de uuid é 'não encontrado', não erro de servidor", async () => {
      resposta = {
        data: null,
        error: { message: "invalid input", code: "22P02" },
      };
      expect(await repo.assinaturaPorId("nao-e-uuid")).toBeNull();
    });

    /** É por aqui que o webhook acha a linha: o id que vem do Mercado Pago. */
    it("assinaturaPorMpId procura pelo id do Mercado Pago", async () => {
      resposta = { data: ASSINATURA, error: null };
      await repo.assinaturaPorMpId("pre-1");

      const filtro = chamadas.find(
        (c) => c.metodo === "eq" && c.args[0] === "mp_preapproval_id",
      );
      expect(filtro?.args).toEqual(["mp_preapproval_id", "pre-1"]);
    });

    it("vincularAssinaturaAoMercadoPago grava o id e o checkout", async () => {
      resposta = { data: ASSINATURA, error: null };
      await repo.vincularAssinaturaAoMercadoPago(ASSINATURA.id, {
        mpPreapprovalId: "pre-1",
        checkoutUrl: ASSINATURA.checkout_url,
      });

      const atualizacao = chamadas.find((c) => c.metodo === "update");
      expect(atualizacao?.args[0]).toEqual({
        mp_preapproval_id: "pre-1",
        checkout_url: ASSINATURA.checkout_url,
      });
    });

    it("vincular assinatura inexistente é 'não encontrado'", async () => {
      resposta = {
        data: null,
        error: { message: "no rows", code: "PGRST116" },
      };
      await expect(
        repo.vincularAssinaturaAoMercadoPago("nao-existe", {
          mpPreapprovalId: "pre-1",
          checkoutUrl: null,
        }),
      ).rejects.toMatchObject({ codigo: "nao_encontrado" });
    });

    it("definirStatusAssinatura devolve null quando nada mudou", async () => {
      // Zero linhas: ou já era esse status, ou já estava cancelada.
      resposta = { data: null, error: null };
      expect(
        await repo.definirStatusAssinatura(ASSINATURA.id, "ativa"),
      ).toBeNull();
    });

    it("erro sem código conhecido vira 'indisponível'", async () => {
      resposta = { data: null, error: { message: "conexão caiu" } };
      await expect(repo.assinaturaViva(LINHA.usuario_id)).rejects.toMatchObject(
        { codigo: "indisponivel" },
      );
      await expect(repo.assinaturaPorMpId("pre-1")).rejects.toMatchObject({
        codigo: "indisponivel",
      });
      await expect(
        repo.criarAssinatura({
          usuarioId: LINHA.usuario_id,
          tipo: "prestador_mensalidade",
          valorCentavos: 1990,
        }),
      ).rejects.toMatchObject({ codigo: "indisponivel" });
      await expect(
        repo.definirStatusAssinatura(ASSINATURA.id, "ativa"),
      ).rejects.toMatchObject({ codigo: "indisponivel" });
      await expect(
        repo.registrarLiquidada({
          usuarioId: LINHA.usuario_id,
          tipo: "prestador_mensalidade",
          valorCentavos: 1990,
          mpPaymentId: "mp-9",
        }),
      ).rejects.toMatchObject({ codigo: "indisponivel" });
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
