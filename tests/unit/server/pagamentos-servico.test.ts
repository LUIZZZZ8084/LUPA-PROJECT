/**
 * @vitest-environment node
 *
 * `temMercadoPagoConfigurado` é uma constante calculada uma vez, na
 * primeira importação de `mercadopago.ts` — por isso cada teste que
 * precisa de um valor diferente para ela usa `vi.resetModules()` e
 * reimporta o serviço depois de `vi.stubEnv`, em vez de mudar
 * `process.env` sozinho e esperar que o módulo já carregado perceba.
 *
 * `estenderMensalidade` é mockado: o que se testa aqui é que
 * `pagamentos/servico.ts` aciona o efeito certo, com o usuário certo —
 * o efeito em si (o que `estenderMensalidade` faz em `perfis_prestador`)
 * tem teste próprio em `prestadores-mensalidade.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";
import type { TipoPagamento } from "@/server/pagamentos/tipos";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const estenderMensalidadeMock = vi.fn(async (_usuarioId: string) => {});
vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: (...args: [string]) => estenderMensalidadeMock(...args),
}));

const sessao: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};

function respostaJson(corpo: unknown, status = 200) {
  return (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

async function carregarServico() {
  vi.resetModules();
  const servico = await import("@/server/pagamentos/servico");
  const repoModulo = await import("@/server/pagamentos");
  const restaurar = repoModulo.usarRepositorioPagamentos(
    new repoModulo.RepositorioPagamentosMemoria(),
  );
  return { servico, restaurar };
}

describe("criarCobranca — sem Mercado Pago configurado (demonstração)", () => {
  let servico: Awaited<ReturnType<typeof carregarServico>>["servico"];
  let restaurar: () => void;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
    estenderMensalidadeMock.mockClear();
    ({ servico, restaurar } = await carregarServico());
  });

  afterEach(() => {
    restaurar();
    vi.unstubAllEnvs();
  });

  it("aprova na hora, sem link de checkout, e já aplica o efeito", async () => {
    const { pagamento, checkoutUrl } = await servico.criarCobranca(
      sessao,
      "prestador_mensalidade",
    );

    expect(checkoutUrl).toBeNull();
    expect(pagamento.status).toBe("aprovado");
    expect(estenderMensalidadeMock).toHaveBeenCalledWith("prestador-1");
  });

  it("cobra o preço da tabela, não um valor arbitrário", async () => {
    const { pagamento } = await servico.criarCobranca(
      sessao,
      "prestador_mensalidade",
    );
    expect(pagamento.valorCentavos).toBe(2490);
  });

  it("recusa sem sessão", async () => {
    await expect(
      servico.criarCobranca(null, "prestador_mensalidade"),
    ).rejects.toMatchObject({ codigo: "nao_autenticado" });
  });

  /*
   * Hoje `TipoPagamento` só tem um valor, e o TypeScript já recusaria
   * este código de propósito — este teste força em runtime o que o
   * compilador nunca deixaria acontecer, para provar que a exaustividade
   * de `aplicarEfeito` falha alto em vez de aprovar uma cobrança sem
   * aplicar efeito nenhum, se o tipo crescer e algum caso ficar para trás.
   */
  it("tipo de pagamento sem efeito implementado falha alto, nunca em silêncio", async () => {
    await expect(
      servico.criarCobranca(
        sessao,
        "tipo_sem_efeito" as unknown as TipoPagamento,
      ),
    ).rejects.toMatchObject({ codigo: "interno" });
  });
});

describe("criarCobranca — com Mercado Pago configurado", () => {
  let servico: Awaited<ReturnType<typeof carregarServico>>["servico"];
  let restaurar: () => void;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
    estenderMensalidadeMock.mockClear();
    ({ servico, restaurar } = await carregarServico());
  });

  afterEach(() => {
    restaurar();
    vi.unstubAllEnvs();
  });

  it("devolve o link do checkout, sem aplicar o efeito ainda", async () => {
    const buscar = respostaJson({
      id: "pref-1",
      init_point: "https://mercadopago.com/checkout/pref-1",
    });

    const { pagamento, checkoutUrl } = await servico.criarCobranca(
      sessao,
      "prestador_mensalidade",
      { buscar },
    );

    expect(checkoutUrl).toBe("https://mercadopago.com/checkout/pref-1");
    expect(pagamento.status).toBe("pendente");
    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  it("propaga a recusa do Mercado Pago como erro de servidor", async () => {
    const buscar = respostaJson({ message: "invalid token" }, 401);
    await expect(
      servico.criarCobranca(sessao, "prestador_mensalidade", { buscar }),
    ).rejects.toMatchObject({ codigo: "indisponivel" });
  });
});

describe("confirmarPagamento", () => {
  let servico: Awaited<ReturnType<typeof carregarServico>>["servico"];
  let restaurar: () => void;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
    estenderMensalidadeMock.mockClear();
    ({ servico, restaurar } = await carregarServico());
  });

  afterEach(() => {
    restaurar();
    vi.unstubAllEnvs();
  });

  async function criarPagamentoPendente(
    idServico: Awaited<ReturnType<typeof carregarServico>>["servico"],
  ) {
    const buscar = respostaJson({
      id: "pref-1",
      init_point: "https://mercadopago.com/checkout/pref-1",
    });
    const { pagamento } = await idServico.criarCobranca(
      sessao,
      "prestador_mensalidade",
      { buscar },
    );
    return pagamento;
  }

  it("aprova e aplica o efeito quando o Mercado Pago confirma", async () => {
    const pagamento = await criarPagamentoPendente(servico);
    const buscar = respostaJson({
      id: "mp-1",
      status: "approved",
      external_reference: pagamento.id,
    });

    await servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).toHaveBeenCalledWith("prestador-1");
  });

  it("é idempotente — webhook repetido não aplica o efeito duas vezes", async () => {
    const pagamento = await criarPagamentoPendente(servico);
    const buscar = respostaJson({
      id: "mp-1",
      status: "approved",
      external_reference: pagamento.id,
    });

    await servico.confirmarPagamento("mp-1", buscar);
    await servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).toHaveBeenCalledTimes(1);
  });

  it("pagamento rejeitado não aplica efeito nenhum", async () => {
    const pagamento = await criarPagamentoPendente(servico);
    const buscar = respostaJson({
      id: "mp-1",
      status: "rejected",
      external_reference: pagamento.id,
    });

    await servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  it("status pendente ou em processamento não muda nada ainda", async () => {
    await criarPagamentoPendente(servico);
    const buscar = respostaJson({
      id: "mp-1",
      status: "in_process",
      external_reference: "não importa",
    });

    await servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  it("resposta do Mercado Pago sem referência externa não lança, só ignora", async () => {
    const buscar = respostaJson({
      id: "mp-sem-referencia",
      status: "approved",
    });

    await expect(
      servico.confirmarPagamento("mp-sem-referencia", buscar),
    ).resolves.toBeUndefined();
    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  it("webhook para um pagamento que não existe aqui não lança, só ignora", async () => {
    const buscar = respostaJson({
      id: "mp-fantasma",
      status: "approved",
      external_reference: "pagamento-que-nunca-existiu",
    });

    await expect(
      servico.confirmarPagamento("mp-fantasma", buscar),
    ).resolves.toBeUndefined();
    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });
});
