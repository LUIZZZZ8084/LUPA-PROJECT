/**
 * @vitest-environment node
 *
 * A varredura que resgata cobrança presa em `pendente` (#198).
 *
 * O caso real: em 10/09/2026 o Mercado Pago **entregou** o aviso da
 * primeira venda de verdade e nós o recusamos com 401, por segredo
 * divergente. O dinheiro entrou, a cobrança ficou `pendente` para sempre,
 * e não existia nenhum caminho para o app descobrir isso sozinho — quem
 * descobriu foi gente lendo a tabela à mão, um dia depois.
 *
 * O que se trava aqui não é o caminho feliz: é a **ordem** entre as
 * tentativas e o que a varredura se recusa a tocar. A cobrança presa não
 * sabe o id do pagamento (era o webhook que ia preenchê-lo), então a volta
 * é por `external_reference` — e uma preferência pode ter várias
 * tentativas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: async () => {},
  revogarMensalidade: async () => {},
}));

vi.mock("@/server/repositories", () => ({
  repositorioUsuarios: () => ({
    porId: async (id: string) => ({ id, email: "empresa@exemplo.com" }),
  }),
}));

const sessao: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };

const PREFERENCIA = {
  id: "pref-1",
  init_point: "https://mercadopago.com/checkout/pref-1",
};

/** Uma tentativa do Mercado Pago, como `/v1/payments/search` a devolve. */
interface Tentativa {
  id: string;
  status: string;
}

/**
 * Um `fetch` que responde três coisas: criar preferência, buscar por
 * referência e consultar um pagamento.
 *
 * O roteamento é por URL porque a varredura encadeia duas chamadas — a
 * busca e, para o escolhido, a releitura — e o que se quer medir é
 * justamente qual das tentativas chegou à releitura.
 */
function mercadoPagoFalso(tentativas: Tentativa[], referencia: () => string) {
  const consultados: string[] = [];

  const buscar = (async (url: string | URL) => {
    const endereco = String(url);

    if (endereco.includes("/checkout/preferences")) {
      return Response.json(PREFERENCIA);
    }

    if (endereco.includes("/v1/payments/search")) {
      return Response.json({
        results: tentativas.map((t) => ({
          id: t.id,
          status: t.status,
          external_reference: referencia(),
        })),
      });
    }

    const id = endereco.split("/v1/payments/")[1] ?? "";
    consultados.push(id);
    const achada = tentativas.find((t) => t.id === id);
    if (!achada) return new Response("", { status: 404 });

    return Response.json({
      id: achada.id,
      status: achada.status,
      external_reference: referencia(),
    });
  }) as unknown as typeof fetch;

  return { buscar, consultados };
}

async function carregar() {
  vi.resetModules();
  const servico = await import("@/server/pagamentos/servico");
  const carteiraServico = await import("@/server/carteiras/servico");
  const pagamentos = await import("@/server/pagamentos");
  const carteiras = await import("@/server/carteiras");

  const repoPagamentos = new pagamentos.RepositorioPagamentosMemoria();
  const repoCarteiras = new carteiras.RepositorioCarteirasMemoria();
  const restaurarP = pagamentos.usarRepositorioPagamentos(repoPagamentos);
  const restaurarC = carteiras.usarRepositorioCarteiras(repoCarteiras);

  return {
    servico,
    carteiraServico,
    repoPagamentos,
    restaurar: () => {
      restaurarP();
      restaurarC();
    },
  };
}

type Contexto = Awaited<ReturnType<typeof carregar>>;

/** Onze minutos: passou da carência que a varredura dá ao webhook. */
const DEPOIS_DA_CARENCIA = new Date(Date.now() + 11 * 60_000);

describe("varredura de cobranças presas", () => {
  let ctx: Contexto;

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "APP_USR-token");
    ctx = await carregar();
  });

  afterEach(() => {
    ctx?.restaurar();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Cria a cobrança presa e devolve o id dela. */
  async function cobrancaPresa(tentativas: Tentativa[]) {
    let id = "";
    const mp = mercadoPagoFalso(tentativas, () => id);

    const { pagamento } = await ctx.servico.comprar(
      sessao,
      "empresa_vaga_avulsa",
      { buscar: mp.buscar },
    );
    id = pagamento.id;

    expect(pagamento.status).toBe("pendente");
    return { id, mp };
  }

  it("a cobrança que o Mercado Pago aprovou sai de pendente e credita", async () => {
    const { id, mp } = await cobrancaPresa([
      { id: "mp-1", status: "approved" },
    ]);

    const resultado = await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: mp.buscar,
    });

    expect(resultado).toEqual({ vistas: 1, reconciliadas: 1 });
    expect((await ctx.repoPagamentos.porId(id))?.status).toBe("aprovado");
    expect(
      await ctx.carteiraServico.direitoDePublicar("empresa-1"),
    ).toMatchObject({ creditos: 1 });
  });

  /**
   * O caso que decide se a varredura está certa ou é perigosa.
   *
   * Cartão recusado e depois PIX aprovado geram duas tentativas para a
   * mesma referência. Processar a recusada primeiro marcaria a cobrança
   * como `rejeitado` — e a aprovada chegaria depois sem encontrar nada
   * `pendente` para aprovar, porque a guarda mora na própria instrução do
   * banco. **O crédito sumiria de vez, por causa da ordem.**
   */
  it("com uma recusada e uma aprovada, é a aprovada que vale", async () => {
    const { id, mp } = await cobrancaPresa([
      { id: "mp-recusada", status: "rejected" },
      { id: "mp-aprovada", status: "approved" },
    ]);

    await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: mp.buscar,
    });

    expect((await ctx.repoPagamentos.porId(id))?.status).toBe("aprovado");
    expect(mp.consultados).toEqual(["mp-aprovada"]);
  });

  /**
   * Boleto em aberto e PIX não pago são `pending` lá também. Encerrar a
   * cobrança aqui tiraria de alguém uma compra que ele ainda pode
   * concluir.
   */
  it("cobrança que ainda pode virar dinheiro não é tocada", async () => {
    const { id, mp } = await cobrancaPresa([{ id: "mp-1", status: "pending" }]);

    const resultado = await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: mp.buscar,
    });

    expect(resultado).toEqual({ vistas: 1, reconciliadas: 0 });
    expect((await ctx.repoPagamentos.porId(id))?.status).toBe("pendente");
    expect(mp.consultados).toEqual([]);
  });

  /** Quem nunca chegou a pagar não tem tentativa nenhuma lá. */
  it("checkout abandonado fica como está", async () => {
    const { id, mp } = await cobrancaPresa([]);

    const resultado = await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: mp.buscar,
    });

    expect(resultado).toEqual({ vistas: 1, reconciliadas: 0 });
    expect((await ctx.repoPagamentos.porId(id))?.status).toBe("pendente");
  });

  /**
   * A carência existe para não competir com o webhook, que é o caminho
   * normal e chega em segundos.
   */
  it("cobrança recém-criada fica fora da janela", async () => {
    const { id, mp } = await cobrancaPresa([
      { id: "mp-1", status: "approved" },
    ]);

    const resultado = await ctx.servico.reconciliarPagamentosPendentes({
      agora: new Date(),
      buscar: mp.buscar,
    });

    expect(resultado).toEqual({ vistas: 0, reconciliadas: 0 });
    expect((await ctx.repoPagamentos.porId(id))?.status).toBe("pendente");
  });

  /** PIX expira e boleto vence: perguntar para sempre é gastar à toa. */
  it("cobrança velha demais sai do alcance", async () => {
    const { id, mp } = await cobrancaPresa([
      { id: "mp-1", status: "approved" },
    ]);

    const resultado = await ctx.servico.reconciliarPagamentosPendentes({
      agora: new Date(Date.now() + 8 * 24 * 60 * 60_000),
      buscar: mp.buscar,
    });

    expect(resultado).toEqual({ vistas: 0, reconciliadas: 0 });
    expect((await ctx.repoPagamentos.porId(id))?.status).toBe("pendente");
  });

  /**
   * Rodar de novo não pode creditar de novo. A garantia é de
   * `confirmarPagamento`, cuja aprovação é condicional na própria
   * instrução — aqui se confere que a varredura não a contorna.
   */
  it("rodar duas vezes credita uma vez só", async () => {
    const { mp } = await cobrancaPresa([{ id: "mp-1", status: "approved" }]);

    await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: mp.buscar,
    });
    const segunda = await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: mp.buscar,
    });

    expect(segunda).toEqual({ vistas: 0, reconciliadas: 0 });
    expect(
      await ctx.carteiraServico.direitoDePublicar("empresa-1"),
    ).toMatchObject({ creditos: 1 });
  });

  /**
   * Vinte presas e uma quebrada não podem virar vinte e uma não
   * resolvidas.
   */
  it("uma cobrança que estoura não derruba a varredura", async () => {
    const primeira = await cobrancaPresa([{ id: "mp-1", status: "approved" }]);
    const segunda = await cobrancaPresa([{ id: "mp-2", status: "approved" }]);

    const explode = (async (url: string | URL) => {
      const endereco = String(url);
      if (endereco.includes(primeira.id)) throw new Error("rede caiu");
      return segunda.mp.buscar(url as string);
    }) as unknown as typeof fetch;

    const resultado = await ctx.servico.reconciliarPagamentosPendentes({
      agora: DEPOIS_DA_CARENCIA,
      buscar: explode,
    });

    expect(resultado.vistas).toBe(2);
    expect((await ctx.repoPagamentos.porId(segunda.id))?.status).toBe(
      "aprovado",
    );
  });
});
