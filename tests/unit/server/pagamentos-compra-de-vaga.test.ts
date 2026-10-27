/**
 * @vitest-environment node
 *
 * Comprar vaga: a compra única e o que ela credita (#172, #489).
 *
 * É o outro caminho do Mercado Pago — Checkout Pro, que cobra uma vez e
 * acabou, em vez do `preapproval`, que autoriza um cartão e cobra todo
 * mês. Os dois convivem porque vendem coisas diferentes: a vaga avulsa
 * não expira e não renova; os planos renovam e não viram crédito.
 *
 * O que se protege aqui é o par que ninguém vê falhar de imediato: que a
 * compra credite **a quantidade certa**, e que o estorno tire de volta.
 * E, desde a #489, que cada plano grave o **limite** certo — um Plano 5
 * gravando "ilimitado" só apareceria na fatura de quem pagou menos.
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

    it("a vaga avulsa credita 1 e cobra o preço da tabela", async () => {
      const { pagamento, checkoutUrl } = await ctx.servico.comprar(
        sessao,
        "empresa_vaga_avulsa",
      );

      expect(checkoutUrl).toBeNull();
      expect(pagamento.status).toBe("aprovado");
      expect(pagamento.valorCentavos).toBe(1990);
      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
      ).toBe(1);
    });

    it("comprar duas vezes soma os créditos", async () => {
      await ctx.servico.comprar(sessao, "empresa_vaga_avulsa");
      await ctx.servico.comprar(sessao, "empresa_vaga_avulsa");

      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .creditos,
      ).toBe(2);
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
    it.each([
      "prestador_mensalidade",
      "empresa_plano_5",
      "empresa_plano_10",
      "empresa_mensal",
    ] as const)(
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
        "empresa_vaga_avulsa",
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
        ctx.servico.comprar(sessao, "empresa_vaga_avulsa", {
          buscar: respostaJson({ message: "invalid token" }, 401),
        }),
      ).rejects.toMatchObject({ codigo: "indisponivel" });
    });

    /** O webhook é quem credita, e só quando o pagamento é aprovado. */
    it("o webhook aprovando credita a vaga", async () => {
      const { pagamento } = await ctx.servico.comprar(
        sessao,
        "empresa_vaga_avulsa",
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
      ).toBe(1);
    });

    it("pagamento recusado não credita nada", async () => {
      const { pagamento } = await ctx.servico.comprar(
        sessao,
        "empresa_vaga_avulsa",
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
        "empresa_vaga_avulsa",
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

  /**
   * Os três planos (#489): o mesmo produto com três tetos.
   *
   * O que cada um grava na carteira é o limite de vagas no ar, e é o que
   * decide quantas a empresa publica. O erro que ninguém vê falhar de
   * imediato é o plano de 5 gravar "ilimitado": a empresa publicaria vinte
   * e pagaria o preço de cinco.
   */
  describe("planos de vagas", () => {
    beforeEach(async () => {
      vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
      ctx = await carregar();
    });

    it.each([
      ["empresa_plano_5", 5, 4990],
      ["empresa_plano_10", 10, 7990],
      ["empresa_mensal", null, 9990],
    ] as const)(
      "%s grava o limite %s e cobra o preço da tabela",
      async (tipo, limite, centavos) => {
        const { assinatura } = await ctx.servico.assinar(sessao, tipo);

        expect(assinatura.valorCentavos).toBe(centavos);
        const direito = await ctx.carteiraServico.direitoDePublicar(
          sessao.usuarioId,
        );
        expect(direito.mensalAtivo).toBe(true);
        expect(direito.limiteNoAr).toBe(limite);
        expect(direito.creditos).toBe(0);
      },
    );

    it("diz qual é o plano ativo", async () => {
      expect(await ctx.servico.planoDeVagasAtual(sessao)).toBeNull();

      await ctx.servico.assinar(sessao, "empresa_plano_10");

      expect(await ctx.servico.planoDeVagasAtual(sessao)).toMatchObject({
        tipo: "empresa_plano_10",
      });
    });

    /**
     * Dois planos vivos seriam duas cobranças por mês para um benefício
     * só — o erro que só aparece na fatura de quem pagou. A recusa diz o
     * caminho, em vez de só negar.
     */
    it("assinar outro plano com um ativo é recusado, e a mensagem diz como trocar", async () => {
      await ctx.servico.assinar(sessao, "empresa_plano_5");

      const erro = await ctx.servico
        .assinar(sessao, "empresa_plano_10")
        .catch((e) => e);

      expect(erro).toMatchObject({ codigo: "validacao" });
      expect(JSON.stringify(erro)).toMatch(/cancele a renovação/i);
      expect(
        (await ctx.carteiraServico.direitoDePublicar(sessao.usuarioId))
          .limiteNoAr,
        "o plano de 5 não pode ter virado 10 por uma tentativa recusada",
      ).toBe(5);
    });

    it("cancelar a renovação não tira os dias que já foram pagos", async () => {
      await ctx.servico.assinar(sessao, "empresa_plano_5");

      expect(await ctx.servico.cancelarPlanoDeVagas(sessao)).toEqual({
        ok: true,
      });

      const direito = await ctx.carteiraServico.direitoDePublicar(
        sessao.usuarioId,
      );
      expect(direito.mensalAtivo).toBe(true);
      expect(direito.limiteNoAr).toBe(5);
      expect(await ctx.servico.planoDeVagasAtual(sessao)).toBeNull();
    });

    it("depois de cancelar, assina o plano maior e o limite passa a valer na hora", async () => {
      await ctx.servico.assinar(sessao, "empresa_plano_5");
      await ctx.servico.cancelarPlanoDeVagas(sessao);

      await ctx.servico.assinar(sessao, "empresa_plano_10");

      const direito = await ctx.carteiraServico.direitoDePublicar(
        sessao.usuarioId,
      );
      expect(direito.limiteNoAr).toBe(10);
      expect(await ctx.servico.planoDeVagasAtual(sessao)).toMatchObject({
        tipo: "empresa_plano_10",
      });
    });

    it("sem plano ativo, cancelar diz que não há o que cancelar", async () => {
      expect(await ctx.servico.cancelarPlanoDeVagas(sessao)).toMatchObject({
        ok: false,
      });
    });

    it("cancelar o plano de vagas exige sessão", async () => {
      await expect(
        ctx.servico.cancelarPlanoDeVagas(null),
      ).rejects.toMatchObject({ codigo: "nao_autenticado" });
    });
  });

  /**
   * Quem desiste de um plano no meio do checkout e quer outro não pode
   * ficar travado por uma assinatura que nunca foi paga.
   */
  describe("trocar de plano no meio do checkout", () => {
    beforeEach(async () => {
      vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "token-de-teste");
      ctx = await carregar();
    });

    it("o checkout pendente de outro plano é encerrado sem perguntar", async () => {
      const chamadas: { url: string; metodo: string }[] = [];
      const buscar = (async (url: string, init?: RequestInit) => {
        chamadas.push({ url, metodo: init?.method ?? "GET" });
        const novo = `pre-${chamadas.length}`;
        return new Response(
          JSON.stringify({
            id: novo,
            init_point: `https://mercadopago.com/subscriptions/${novo}`,
            status: "pending",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch;

      const primeira = await ctx.servico.assinar(sessao, "empresa_plano_5", {
        buscar,
      });
      expect(primeira.assinatura.status).toBe("pendente");

      const segunda = await ctx.servico.assinar(sessao, "empresa_plano_10", {
        buscar,
      });

      expect(segunda.assinatura.tipo).toBe("empresa_plano_10");
      expect(
        chamadas.some((c) => c.metodo === "PUT"),
        "o checkout antigo precisa ser cancelado no Mercado Pago",
      ).toBe(true);
      expect(
        (await ctx.servico.estadoDaAssinatura(sessao, "empresa_plano_5"))
          .assinatura,
      ).toBeNull();
    });
  });
});
