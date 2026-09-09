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
const revogarMensalidadeMock = vi.fn(async (_usuarioId: string) => {});
vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: (...args: [string]) => estenderMensalidadeMock(...args),
  revogarMensalidade: (...args: [string]) => revogarMensalidadeMock(...args),
}));

/**
 * O `preapproval` exige o e-mail de quem vai pagar, e ele sai do
 * repositório de usuários — não da sessão, que só carrega id e papel.
 */
vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    porId: async (id: string) => ({ id, email: "prestador@exemplo.com" }),
  }),
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

const PREAPPROVAL = {
  id: "pre-1",
  init_point: "https://mercadopago.com/subscriptions/pre-1",
  status: "pending",
};

async function carregarServico() {
  vi.resetModules();
  const servico = await import("@/server/pagamentos/servico");
  const repoModulo = await import("@/server/pagamentos");
  const repo = new repoModulo.RepositorioPagamentosMemoria();
  const restaurar = repoModulo.usarRepositorioPagamentos(repo);
  return { servico, repo, restaurar };
}

type Contexto = Awaited<ReturnType<typeof carregarServico>>;

describe("assinar — sem Mercado Pago configurado (demonstração)", () => {
  let ctx: Contexto;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
    estenderMensalidadeMock.mockClear();
    revogarMensalidadeMock.mockClear();
    ctx = await carregarServico();
  });

  afterEach(() => {
    ctx.restaurar();
    vi.unstubAllEnvs();
  });

  it("nasce ativa, com a primeira cobrança aprovada e o efeito aplicado", async () => {
    const { assinatura, pagamento, checkoutUrl } = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
    );

    expect(checkoutUrl).toBeNull();
    expect(assinatura.status).toBe("ativa");
    expect(pagamento?.status).toBe("aprovado");
    // Em demonstração não há teste grátis: a assinatura já nasce cobrada,
    // e o efeito usa a extensão normal de 30 dias — não os 15 do teste.
    expect(estenderMensalidadeMock).toHaveBeenCalledWith("prestador-1");
  });

  it("a cobrança nasce ligada à assinatura que a gerou", async () => {
    const { assinatura, pagamento } = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
    );
    expect(pagamento?.assinaturaId).toBe(assinatura.id);
  });

  it("cobra o preço da tabela, não um valor arbitrário", async () => {
    const { pagamento } = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
    );
    expect(pagamento?.valorCentavos).toBe(1990);
  });

  it("recusa sem sessão", async () => {
    await expect(
      ctx.servico.assinar(null, "prestador_mensalidade"),
    ).rejects.toMatchObject({ codigo: "nao_autenticado" });
  });

  /**
   * Clicar duas vezes não pode virar duas assinaturas: seriam duas
   * autorizações no Mercado Pago e duas cobranças por mês na mesma
   * pessoa — o tipo de erro que só aparece na fatura de quem pagou.
   */
  it("quem já tem assinatura ativa não cria outra", async () => {
    await ctx.servico.assinar(sessao, "prestador_mensalidade");

    await expect(
      ctx.servico.assinar(sessao, "prestador_mensalidade"),
    ).rejects.toMatchObject({ codigo: "validacao" });
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
      ctx.servico.assinar(
        sessao,
        "tipo_sem_efeito" as unknown as TipoPagamento,
      ),
    ).rejects.toMatchObject({ codigo: "interno" });
  });
});

describe("assinar — com Mercado Pago configurado", () => {
  let ctx: Contexto;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
    estenderMensalidadeMock.mockClear();
    revogarMensalidadeMock.mockClear();
    ctx = await carregarServico();
  });

  afterEach(() => {
    ctx.restaurar();
    vi.unstubAllEnvs();
  });

  it("devolve o link de autorização, sem aplicar o efeito ainda", async () => {
    const { assinatura, pagamento, checkoutUrl } = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
      { buscar: respostaJson(PREAPPROVAL) },
    );

    expect(checkoutUrl).toBe(PREAPPROVAL.init_point);
    expect(assinatura.status).toBe("pendente");
    expect(assinatura.mpPreapprovalId).toBe("pre-1");
    expect(pagamento).toBeNull();
    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  /**
   * Quem começou e não terminou volta ao **mesmo** checkout. Criar um
   * `preapproval` novo a cada clique deixaria autorizações órfãs no
   * Mercado Pago, e duas autorizadas cobrariam duas vezes.
   */
  it("clicar de novo com uma assinatura pendente reaproveita o checkout", async () => {
    let chamadas = 0;
    const contando = (async () => {
      chamadas += 1;
      return new Response(JSON.stringify(PREAPPROVAL), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const primeira = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
      { buscar: contando },
    );
    const segunda = await ctx.servico.assinar(sessao, "prestador_mensalidade", {
      buscar: contando,
    });

    expect(segunda.assinatura.id).toBe(primeira.assinatura.id);
    expect(segunda.checkoutUrl).toBe(primeira.checkoutUrl);
    expect(chamadas, "não pode criar um preapproval novo").toBe(1);
  });

  it("propaga a recusa do Mercado Pago como erro de servidor", async () => {
    await expect(
      ctx.servico.assinar(sessao, "prestador_mensalidade", {
        buscar: respostaJson({ message: "invalid token" }, 401),
      }),
    ).rejects.toMatchObject({ codigo: "indisponivel" });
  });
});

describe("cancelarRenovacao", () => {
  let ctx: Contexto;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
    estenderMensalidadeMock.mockClear();
    revogarMensalidadeMock.mockClear();
    ctx = await carregarServico();
  });

  afterEach(() => {
    ctx.restaurar();
    vi.unstubAllEnvs();
  });

  it("marca a assinatura como cancelada", async () => {
    const { assinatura } = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
    );

    const resultado = await ctx.servico.cancelarRenovacao(sessao);

    expect(resultado.ok).toBe(true);
    expect((await ctx.repo.assinaturaPorId(assinatura.id))?.status).toBe(
      "cancelada",
    );
  });

  /**
   * O que separa cancelar de estornar: **os dias já pagos continuam
   * valendo**. Revogar a mensalidade aqui tiraria da vitrine alguém que
   * pagou pelo mês inteiro e só não quer o mês seguinte.
   */
  it("não revoga a mensalidade — quem pagou o mês fica até o fim dele", async () => {
    await ctx.servico.assinar(sessao, "prestador_mensalidade");
    revogarMensalidadeMock.mockClear();

    await ctx.servico.cancelarRenovacao(sessao);

    expect(
      revogarMensalidadeMock,
      "cancelar interrompe o futuro, não desfaz o mês pago",
    ).not.toHaveBeenCalled();
  });

  it("sem assinatura viva, recusa sem quebrar", async () => {
    const resultado = await ctx.servico.cancelarRenovacao(sessao);
    expect(resultado.ok).toBe(false);
  });

  it("sem sessão é 401", async () => {
    await expect(ctx.servico.cancelarRenovacao(null)).rejects.toMatchObject({
      codigo: "nao_autenticado",
    });
  });

  /** Cancelada é terminal: assinar depois cria outra, nunca ressuscita. */
  it("depois de cancelar dá para assinar de novo", async () => {
    const primeira = await ctx.servico.assinar(sessao, "prestador_mensalidade");
    await ctx.servico.cancelarRenovacao(sessao);

    const segunda = await ctx.servico.assinar(sessao, "prestador_mensalidade");

    expect(segunda.assinatura.id).not.toBe(primeira.assinatura.id);
    expect(segunda.assinatura.status).toBe("ativa");
  });
});

describe("confirmarPagamento", () => {
  let ctx: Contexto;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
    estenderMensalidadeMock.mockClear();
    revogarMensalidadeMock.mockClear();
    ctx = await carregarServico();
  });

  afterEach(() => {
    ctx.restaurar();
    vi.unstubAllEnvs();
  });

  /** Uma cobrança avulsa pendente, gravada direto — sem passar pelo checkout. */
  async function cobrancaPendente() {
    return ctx.repo.criar({
      usuarioId: sessao.usuarioId,
      tipo: "prestador_mensalidade",
      valorCentavos: 1990,
    });
  }

  it("aprova e aplica o efeito quando o Mercado Pago confirma", async () => {
    const pagamento = await cobrancaPendente();
    const buscar = respostaJson({
      id: "mp-1",
      status: "approved",
      external_reference: pagamento.id,
    });

    await ctx.servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).toHaveBeenCalledWith("prestador-1");
  });

  it("é idempotente — webhook repetido não aplica o efeito duas vezes", async () => {
    const pagamento = await cobrancaPendente();
    const buscar = respostaJson({
      id: "mp-1",
      status: "approved",
      external_reference: pagamento.id,
    });

    await ctx.servico.confirmarPagamento("mp-1", buscar);
    await ctx.servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).toHaveBeenCalledTimes(1);
  });

  it("pagamento rejeitado não aplica efeito nenhum", async () => {
    const pagamento = await cobrancaPendente();
    const buscar = respostaJson({
      id: "mp-1",
      status: "rejected",
      external_reference: pagamento.id,
    });

    await ctx.servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  it("status pendente ou em processamento não muda nada ainda", async () => {
    const pagamento = await cobrancaPendente();
    const buscar = respostaJson({
      id: "mp-1",
      status: "in_process",
      external_reference: pagamento.id,
    });

    await ctx.servico.confirmarPagamento("mp-1", buscar);

    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });

  it("resposta do Mercado Pago sem referência externa não lança, só ignora", async () => {
    const buscar = respostaJson({
      id: "mp-sem-referencia",
      status: "approved",
    });

    await expect(
      ctx.servico.confirmarPagamento("mp-sem-referencia", buscar),
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
      ctx.servico.confirmarPagamento("mp-fantasma", buscar),
    ).resolves.toBeUndefined();
    expect(estenderMensalidadeMock).not.toHaveBeenCalled();
  });
});
