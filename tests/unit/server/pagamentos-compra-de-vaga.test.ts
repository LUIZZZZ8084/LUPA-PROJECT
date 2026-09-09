/**
 * @vitest-environment node
 *
 * Comprar vaga: a compra única e o que ela credita (#172).
 *
 * É o outro caminho do Mercado Pago — Checkout Pro, que cobra uma vez e
 * acabou, em vez do `preapproval`, que autoriza um cartão e cobra todo
 * mês. Os dois convivem porque vendem coisas diferentes: crédito de vaga
 * não expira e não renova; o plano mensal renova e não vira crédito.
 *
 * O que se protege aqui é o par que ninguém vê falhar de imediato: que a
 * compra credite **a quantidade certa**, e que o estorno tire de volta.
 * Um pacote de 15 creditando 5 só apareceria na reclamação de quem pagou.
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

function respostaJson(corpo: unknown, status = 200) {
  return (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const PREFERENCIA = {
  id: "pref-1",
  init_point: "https://mercadopago.com/checkout/pref-1",
};

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

describe("comprar vaga", () => {
  let ctx: Contexto;

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    ctx?.restaurar();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("sem Mercado Pago configurado (demonstração)", () => {
    beforeEach(async () => {
      vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
      ctx = await carregar();
    });

    it.each([
      ["empresa_vaga_avulsa", 1, 2990],
      ["empresa_pacote_5", 5, 10000],
      ["empresa_pacote_15", 15, 14990],
    ] as const)(
      "%s credita %i vaga(s) e cobra o preço da tabela",
      async (tipo, creditos, centavos) => {
        const { pagamento, checkoutUrl } = await ctx.servico.comprar(
          sessao,
          tipo,
        );

        expect(checkoutUrl).toBeNull();
        expect(pagamento.status).toBe("aprovado");
        expect(pagamento.valorCentavos).toBe(centavos);
        expect(
          (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
            .creditos,
        ).toBe(creditos);
      },
    );

    it("comprar duas vezes soma os créditos", async () => {
      await ctx.servico.comprar(sessao, "empresa_pacote_5");
      await ctx.servico.comprar(sessao, "empresa_vaga_avulsa");

      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
      ).toBe(6);
    });

    it("recusa sem sessão", async () => {
      await expect(
        ctx.servico.comprar(null, "empresa_vaga_avulsa"),
      ).rejects.toMatchObject({ codigo: "nao_autenticado" });
    });

    /**
     * Mandar uma assinatura por aqui criaria uma cobrança única que
     * ninguém renovaria — a pessoa pagaria um mês achando que assinou, e
     * descobriria no mês seguinte, sem plano e sem aviso.
     */
    it.each(["prestador_mensalidade", "empresa_mensal"] as const)(
      "recusa %s, que é assinatura e não compra única",
      async (tipo) => {
        await expect(ctx.servico.comprar(sessao, tipo)).rejects.toMatchObject({
          codigo: "interno",
        });
      },
    );
  });

  describe("com Mercado Pago configurado", () => {
    beforeEach(async () => {
      vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
      ctx = await carregar();
    });

    it("devolve o checkout e não credita nada ainda", async () => {
      const { pagamento, checkoutUrl } = await ctx.servico.comprar(
        sessao,
        "empresa_pacote_5",
        { buscar: respostaJson(PREFERENCIA) },
      );

      expect(checkoutUrl).toBe(PREFERENCIA.init_point);
      expect(pagamento.status).toBe("pendente");
      expect(pagamento.mpPreferenceId).toBe("pref-1");
      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
        "crédito só existe depois de o Mercado Pago confirmar",
      ).toBe(0);
    });

    it("propaga a recusa do Mercado Pago como erro de servidor", async () => {
      await expect(
        ctx.servico.comprar(sessao, "empresa_pacote_5", {
          buscar: respostaJson({ message: "invalid token" }, 401),
        }),
      ).rejects.toMatchObject({ codigo: "indisponivel" });
    });

    /** O webhook é quem credita, e só quando o pagamento é aprovado. */
    it("o webhook aprovando credita o pacote inteiro", async () => {
      const { pagamento } = await ctx.servico.comprar(
        sessao,
        "empresa_pacote_15",
        { buscar: respostaJson(PREFERENCIA) },
      );

      await ctx.servico.confirmarPagamento(
        "mp-1",
        respostaJson({
          id: "mp-1",
          status: "approved",
          external_reference: pagamento.id,
        }),
      );

      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
      ).toBe(15);
    });

    it("pagamento recusado não credita nada", async () => {
      const { pagamento } = await ctx.servico.comprar(
        sessao,
        "empresa_pacote_15",
        { buscar: respostaJson(PREFERENCIA) },
      );

      await ctx.servico.confirmarPagamento(
        "mp-1",
        respostaJson({
          id: "mp-1",
          status: "rejected",
          external_reference: pagamento.id,
        }),
      );

      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
      ).toBe(0);
    });

    /**
     * Estorno tira o que sobrou, e a vaga já publicada continua no ar —
     * apagar o anúncio de quem talvez já esteja recebendo currículo, por
     * uma contestação que ela pode nem ter feito, seria pior.
     */
    it("estorno tira os créditos de volta", async () => {
      const { pagamento } = await ctx.servico.comprar(
        sessao,
        "empresa_pacote_5",
        { buscar: respostaJson(PREFERENCIA) },
      );
      const aprovado = respostaJson({
        id: "mp-1",
        status: "approved",
        external_reference: pagamento.id,
      });
      await ctx.servico.confirmarPagamento("mp-1", aprovado);

      await ctx.servico.confirmarPagamento(
        "mp-1",
        respostaJson({
          id: "mp-1",
          status: "refunded",
          external_reference: pagamento.id,
        }),
      );

      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
      ).toBe(0);
    });
  });

  describe("plano mensal", () => {
    beforeEach(async () => {
      vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
      ctx = await carregar();
    });

    /**
     * O mensal libera publicação **sem virar crédito**. Misturar os dois
     * faria a pessoa acumular saldo que ela não precisa usar, e depois
     * não entender por que o número não desce quando publica.
     */
    it("assinar o mensal libera sem creditar nada", async () => {
      await ctx.servico.assinar(sessao, "empresa_mensal");

      const direito = await ctx.carteiraServico.direitoDePublicar(
        sessao.usuarioId,
      );
      expect(direito.pode).toBe(true);
      expect(direito.mensalAtivo).toBe(true);
      expect(direito.creditos).toBe(0);
    });

    /** O plano mensal não tem teste grátis: `diasDeTeste` devolve zero. */
    it("não concede teste grátis", async () => {
      const { assinatura } = await ctx.servico.assinar(
        sessao,
        "empresa_mensal",
      );

      // Em demonstração a assinatura já nasce cobrada, então o que se
      // confere é que o efeito veio da cobrança — não de um teste.
      expect(assinatura.status).toBe("ativa");
      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .mensalAtivo,
      ).toBe(true);
    });

    /**
     * Duas assinaturas vivas ao mesmo tempo, e cada uma com a própria
     * saída: um prestador que contrata ajudante tem a mensalidade da
     * vitrine e o plano de vagas. Cancelar uma não pode cancelar a outra.
     */
    it("cancelar o plano de vagas não mexe na mensalidade de prestador", async () => {
      await ctx.servico.assinar(sessao, "prestador_mensalidade");
      await ctx.servico.assinar(sessao, "empresa_mensal");

      await ctx.servico.cancelarRenovacao(sessao, "empresa_mensal");

      const prestador = await ctx.servico.estadoDaAssinatura(
        sessao,
        "prestador_mensalidade",
      );
      expect(prestador.assinatura?.status).toBe("ativa");
    });
  });
});
