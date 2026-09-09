/**
 * @vitest-environment node
 *
 * A renovação automática, do aviso do Mercado Pago até a mensalidade
 * estendida (#170).
 *
 * O que se prova aqui é o que a suíte antiga não tinha como provar: que a
 * mensalidade continua valendo **sem ninguém clicar em nada**. O modelo
 * anterior era pagamento avulso — pagava, ganhava 30 dias, e no dia 31 o
 * perfil sumia da vitrine sem cobrança nova e sem aviso.
 *
 * São três avisos diferentes, e o `data.id` de cada um aponta para um
 * recurso diferente. O teste mais importante do arquivo é o último: o
 * mesmo pagamento chegando pelos **dois** caminhos não pode estender 60
 * dias. A redundância é deliberada — os tópicos são marcados à mão no
 * painel do Mercado Pago, e uma renovação que só funciona se alguém
 * lembrou de marcar a caixa certa falha em silêncio —, mas ela só é
 * segura se a idempotência for de verdade.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const estender = vi.fn(async (_usuarioId: string, _dias?: number) => {});
const revogar = vi.fn(async (_usuarioId: string) => {});
vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: (...args: [string, number?]) => estender(...args),
  revogarMensalidade: (...args: [string]) => revogar(...args),
}));

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

/** O que `POST /preapproval` devolve. */
const PREAPPROVAL = {
  id: "pre-1",
  init_point: "https://mercadopago.com/subscriptions/pre-1",
  status: "pending",
};

/** O que `GET /authorized_payments/{id}` devolve numa parcela cobrada. */
function faturaCobrada(mpPaymentId: string) {
  return respostaJson({
    id: "auth-1",
    preapproval_id: "pre-1",
    transaction_amount: 19.9,
    payment: { id: mpPaymentId, status: "approved" },
  });
}

async function carregar() {
  vi.resetModules();
  const servico = await import("@/server/pagamentos/servico");
  const repoModulo = await import("@/server/pagamentos");
  const repo = new repoModulo.RepositorioPagamentosMemoria();
  const restaurar = repoModulo.usarRepositorioPagamentos(repo);
  return { servico, repo, restaurar };
}

describe("renovação automática", () => {
  let ctx: Awaited<ReturnType<typeof carregar>>;

  beforeEach(async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
    estender.mockClear();
    revogar.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ctx = await carregar();
  });

  afterEach(() => {
    ctx.restaurar();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Uma assinatura pendente, já vinculada ao `preapproval` do Mercado Pago. */
  async function assinaturaPendente() {
    const { assinatura } = await ctx.servico.assinar(
      sessao,
      "prestador_mensalidade",
      { buscar: respostaJson(PREAPPROVAL) },
    );
    return assinatura;
  }

  describe("subscription_preapproval — o estado da assinatura", () => {
    it("authorized deixa a assinatura ativa", async () => {
      const assinatura = await assinaturaPendente();

      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "authorized" }),
      );

      expect((await ctx.repo.assinaturaPorId(assinatura.id))?.status).toBe(
        "ativa",
      );
    });

    /**
     * A primeira vez que vira `ativa` é o início do teste grátis (#170).
     * O cartão acabou de ser autorizado, e a cobrança de verdade só sai
     * `DIAS_TESTE_GRATIS` depois — mas a vitrine precisa liberar o
     * perfil desde já, senão o teste grátis não seria grátis.
     */
    it("authorized concede o teste grátis, não a extensão normal de 30 dias", async () => {
      await assinaturaPendente();

      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "authorized" }),
      );

      expect(estender).toHaveBeenCalledWith("prestador-1", 15);
    });

    /**
     * `pausada → ativa` não é um teste novo — é o Mercado Pago
     * confirmando que voltou a cobrar depois de arrumar o cartão. Já
     * tinha passado pelo teste na primeira autorização; conceder de novo
     * aqui devolveria dias de graça a cada soluço de cartão.
     */
    it("pausada → ativa não concede um novo teste grátis", async () => {
      await assinaturaPendente();
      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "authorized" }),
      );
      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "paused" }),
      );
      estender.mockClear();

      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "authorized" }),
      );

      expect(estender).not.toHaveBeenCalled();
    });

    /**
     * Cancelar dentro do teste tira da busca **na hora**, e é o oposto do
     * que vale para quem já pagou.
     *
     * A diferença é o que a pessoa comprou. Quem pagou o mês tem direito
     * ao mês; quem está no teste não pagou nada e acabou de dizer que não
     * quer — manter o perfil até o fim dos 15 dias seria entregar o teste
     * inteiro a quem desistiu dele, o uso de graça que o fim da carência
     * veio fechar. E é o que a tela promete, com todas as letras.
     */
    it("cancelar dentro do teste grátis tira da busca na hora", async () => {
      await assinaturaPendente();
      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "authorized" }),
      );
      revogar.mockClear();

      await ctx.servico.cancelarRenovacao(sessao, respostaJson({}));

      expect(revogar).toHaveBeenCalledWith("prestador-1");
    });

    /** Já cobrado, a regra se inverte: o mês pago não é encurtado. */
    it("cancelar depois da primeira cobrança não tira da busca", async () => {
      await assinaturaPendente();
      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );
      revogar.mockClear();

      await ctx.servico.cancelarRenovacao(sessao, respostaJson({}));

      expect(revogar).not.toHaveBeenCalled();
    });

    it("aviso repetido de authorized não concede o teste duas vezes", async () => {
      await assinaturaPendente();
      const aviso = respostaJson({ id: "pre-1", status: "authorized" });

      await ctx.servico.confirmarAssinatura("pre-1", aviso);
      await ctx.servico.confirmarAssinatura("pre-1", aviso);

      expect(estender).toHaveBeenCalledTimes(1);
    });

    it("paused marca pausada — cartão recusado não é cancelamento", async () => {
      const assinatura = await assinaturaPendente();

      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "paused" }),
      );

      expect((await ctx.repo.assinaturaPorId(assinatura.id))?.status).toBe(
        "pausada",
      );
    });

    /**
     * Cancelada é terminal. Sem essa guarda, um aviso atrasado de
     * "autorizada" chegando depois do cancelamento ressuscitaria uma
     * assinatura que a pessoa encerrou — e ela voltaria a ser cobrada.
     */
    it("aviso atrasado de authorized não ressuscita uma assinatura cancelada", async () => {
      const assinatura = await assinaturaPendente();
      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "cancelled" }),
      );

      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "authorized" }),
      );

      expect((await ctx.repo.assinaturaPorId(assinatura.id))?.status).toBe(
        "cancelada",
      );
    });

    /**
     * Suspensa não se religa: não há como, sem um meio de pagamento novo.
     * A saída é encerrar esta e abrir outra — e encerrar **antes**, senão
     * a pessoa fica com duas autorizações no Mercado Pago, e a suspensa
     * pode voltar a cobrar.
     */
    it("assinar de novo depois de uma suspensão encerra a antiga primeiro", async () => {
      const antiga = await assinaturaPendente();
      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "paused" }),
      );

      const chamadas: string[] = [];
      const espiao = (async (url: string, init?: RequestInit) => {
        chamadas.push(`${init?.method ?? "GET"} ${url}`);
        return new Response(JSON.stringify({ ...PREAPPROVAL, id: "pre-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch;

      const nova = await ctx.servico.assinar(sessao, "prestador_mensalidade", {
        buscar: espiao,
      });

      expect(chamadas[0], "o cancelamento vem antes da criação").toMatch(
        /^PUT .*preapproval\/pre-1$/,
      );
      expect((await ctx.repo.assinaturaPorId(antiga.id))?.status).toBe(
        "cancelada",
      );
      expect(nova.assinatura.mpPreapprovalId).toBe("pre-2");
    });

    it("se o Mercado Pago recusa encerrar a suspensa, não abre outra", async () => {
      const antiga = await assinaturaPendente();
      await ctx.servico.confirmarAssinatura(
        "pre-1",
        respostaJson({ id: "pre-1", status: "paused" }),
      );

      await expect(
        ctx.servico.assinar(sessao, "prestador_mensalidade", {
          buscar: respostaJson({ message: "erro" }, 500),
        }),
      ).rejects.toMatchObject({ codigo: "indisponivel" });

      expect(
        (await ctx.repo.assinaturaPorId(antiga.id))?.status,
        "duas autorizações vivas no Mercado Pago cobram duas vezes",
      ).toBe("pausada");
    });

    it("aviso de assinatura que não existe aqui não lança, só ignora", async () => {
      await expect(
        ctx.servico.confirmarAssinatura(
          "pre-fantasma",
          respostaJson({ id: "pre-fantasma", status: "authorized" }),
        ),
      ).resolves.toBeUndefined();
    });

    it("Mercado Pago fora do ar não lança — o aviso volta depois", async () => {
      await assinaturaPendente();
      await expect(
        ctx.servico.confirmarAssinatura("pre-1", respostaJson({}, 500)),
      ).resolves.toBeUndefined();
    });
  });

  describe("subscription_authorized_payment — a parcela cobrada", () => {
    it("registra a parcela, ativa a assinatura e estende a mensalidade", async () => {
      const assinatura = await assinaturaPendente();

      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );

      expect(estender).toHaveBeenCalledWith("prestador-1");
      expect((await ctx.repo.assinaturaPorId(assinatura.id))?.status).toBe(
        "ativa",
      );

      const parcela = await ctx.repo.porMpPaymentId("mp-100");
      expect(parcela?.status).toBe("aprovado");
      expect(parcela?.assinaturaId).toBe(assinatura.id);
      expect(parcela?.valorCentavos).toBe(1990);
    });

    it("o mesmo aviso chegando duas vezes estende uma vez só", async () => {
      await assinaturaPendente();

      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );
      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );

      expect(estender).toHaveBeenCalledTimes(1);
    });

    /** Mês seguinte: pagamento diferente, e a mensalidade estende de novo. */
    it("a cobrança do mês seguinte estende outra vez", async () => {
      await assinaturaPendente();

      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );
      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-2",
        faturaCobrada("mp-200"),
      );

      expect(estender).toHaveBeenCalledTimes(2);
    });

    it("parcela recusada não estende nada", async () => {
      await assinaturaPendente();

      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        respostaJson({
          id: "auth-1",
          preapproval_id: "pre-1",
          payment: { id: "mp-100", status: "rejected" },
        }),
      );

      expect(estender).not.toHaveBeenCalled();
    });

    it("fatura ainda sem pagamento gerado não estende nada", async () => {
      await assinaturaPendente();

      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        respostaJson({ id: "auth-1", preapproval_id: "pre-1", payment: null }),
      );

      expect(estender).not.toHaveBeenCalled();
    });

    it("parcela de uma assinatura que não existe aqui não lança", async () => {
      await expect(
        ctx.servico.confirmarParcelaDaAssinatura(
          "auth-1",
          respostaJson({
            id: "auth-1",
            preapproval_id: "pre-desconhecida",
            payment: { id: "mp-100", status: "approved" },
          }),
        ),
      ).resolves.toBeUndefined();
      expect(estender).not.toHaveBeenCalled();
    });
  });

  describe("payment — o caminho de reserva", () => {
    /**
     * O `external_reference` do `preapproval` é herdado por todos os
     * pagamentos que ele gera: a referência de uma parcela é a da
     * **assinatura**, não a de uma cobrança nossa. Sem reconhecer isso,
     * toda renovação cairia no "cobrança que não existe aqui" e a
     * mensalidade só estenderia se o tópico
     * `subscription_authorized_payment` estivesse marcado no painel.
     */
    it("pagamento cuja referência é a assinatura vira parcela do mesmo jeito", async () => {
      const assinatura = await assinaturaPendente();

      await ctx.servico.confirmarPagamento(
        "mp-100",
        respostaJson({
          id: "mp-100",
          status: "approved",
          external_reference: assinatura.id,
        }),
      );

      expect(estender).toHaveBeenCalledWith("prestador-1");
      expect((await ctx.repo.porMpPaymentId("mp-100"))?.status).toBe(
        "aprovado",
      );
    });

    it("pagamento recusado de uma assinatura não estende nada", async () => {
      const assinatura = await assinaturaPendente();

      await ctx.servico.confirmarPagamento(
        "mp-100",
        respostaJson({
          id: "mp-100",
          status: "rejected",
          external_reference: assinatura.id,
        }),
      );

      expect(estender).not.toHaveBeenCalled();
    });

    /**
     * O teste que sustenta a redundância inteira. Os dois tópicos falam
     * do mesmo dinheiro, e chegam quase juntos: se a idempotência não
     * valesse entre eles, toda renovação daria 60 dias por 30 pagos.
     */
    /**
     * O caso que faz a revogação existir, aplicado à recorrência.
     *
     * Uma parcela não tem referência externa própria: o
     * `external_reference` do `preapproval` é herdado por todos os
     * pagamentos que ele gera. Procurando só pela referência,
     * `confirmarPagamento` não acharia a parcela, o chargeback passaria
     * batido, e quem contestou a cobrança continuaria na vitrine — de
     * graça, e sem o app conseguir cobrar.
     */
    it("chargeback de uma parcela revoga a mensalidade e encerra a renovação", async () => {
      const assinatura = await assinaturaPendente();
      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );

      await ctx.servico.confirmarPagamento(
        "mp-100",
        respostaJson({
          id: "mp-100",
          status: "charged_back",
          external_reference: assinatura.id,
        }),
      );

      expect(revogar).toHaveBeenCalledWith("prestador-1");
      expect((await ctx.repo.assinaturaPorId(assinatura.id))?.status).toBe(
        "cancelada",
      );
    });

    it("o chargeback repetido não revoga duas vezes", async () => {
      const assinatura = await assinaturaPendente();
      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );
      const aviso = respostaJson({
        id: "mp-100",
        status: "refunded",
        external_reference: assinatura.id,
      });

      await ctx.servico.confirmarPagamento("mp-100", aviso);
      await ctx.servico.confirmarPagamento("mp-100", aviso);

      expect(revogar).toHaveBeenCalledTimes(1);
    });

    it("o mesmo pagamento pelos dois tópicos estende uma vez só", async () => {
      const assinatura = await assinaturaPendente();

      await ctx.servico.confirmarParcelaDaAssinatura(
        "auth-1",
        faturaCobrada("mp-100"),
      );
      await ctx.servico.confirmarPagamento(
        "mp-100",
        respostaJson({
          id: "mp-100",
          status: "approved",
          external_reference: assinatura.id,
        }),
      );

      expect(estender).toHaveBeenCalledTimes(1);
    });
  });
});
