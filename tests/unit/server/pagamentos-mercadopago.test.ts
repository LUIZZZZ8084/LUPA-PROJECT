/**
 * @vitest-environment node
 *
 * Chamadas cruas ao Mercado Pago.
 *
 * Nenhum teste daqui fala com a rede: o `fetch` é injetado, mesmo padrão
 * de `verificacao-cnpj.test.ts`. Suíte que depende de API de terceiro
 * estar no ar falha vermelho sem ninguém ter mexido em nada.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cancelarAssinaturaNoMercadoPago,
  consultarAssinatura,
  consultarPagamento,
  consultarParcelaDaAssinatura,
  criarAssinaturaRecorrente,
  validarAssinaturaWebhook,
} from "@/server/pagamentos/mercadopago";

function respostaJson(corpo: unknown, status = 200) {
  return (async () =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

const foraDoAr = (async () => {
  throw new Error("timeout");
}) as unknown as typeof fetch;

const DADOS = {
  titulo: "Mensalidade de prestador — Lupa",
  valorCentavos: 1990,
  referenciaExterna: "ass-1",
  emailPagador: "prestador@exemplo.com",
  urlRetorno: "https://lupa.app/pagamento/retorno?assinatura=ass-1",
};

describe("criarAssinaturaRecorrente", () => {
  it("devolve id e link de autorização numa resposta válida", async () => {
    const resultado = await criarAssinaturaRecorrente(
      DADOS,
      respostaJson({
        id: "pre-123",
        init_point: "https://mercadopago.com/subscriptions/pre-123",
        status: "pending",
        external_reference: "ass-1",
      }),
    );

    expect(resultado).toEqual({
      ok: true,
      assinatura: {
        id: "pre-123",
        initPoint: "https://mercadopago.com/subscriptions/pre-123",
        status: "pending",
        referenciaExterna: "ass-1",
      },
    });
  });

  /**
   * O corpo é o contrato com o Mercado Pago, e um campo errado aqui só
   * aparece com dinheiro de verdade em jogo — mensal em vez de anual,
   * ou o valor em reais lido como centavos.
   */
  it("manda recorrência mensal, em reais, com o e-mail de quem vai pagar", async () => {
    let corpoEnviado: Record<string, unknown> = {};
    const espiao = (async (_url: string, init: RequestInit) => {
      corpoEnviado = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          id: "pre-1",
          init_point: "https://x",
          status: "pending",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await criarAssinaturaRecorrente(DADOS, espiao);

    expect(corpoEnviado.auto_recurring).toEqual({
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 19.9,
      currency_id: "BRL",
    });
    expect(corpoEnviado.payer_email).toBe("prestador@exemplo.com");
    expect(corpoEnviado.external_reference).toBe("ass-1");
    expect(corpoEnviado.status).toBe("pending");
  });

  /**
   * O teste grátis (#170) é o `free_trial` do `auto_recurring`, não um
   * campo à parte — sem ele, o Mercado Pago cobra assim que a pessoa
   * autoriza o cartão.
   */
  it("com diasTeste, manda free_trial em dias", async () => {
    let corpoEnviado: Record<string, unknown> = {};
    const espiao = (async (_url: string, init: RequestInit) => {
      corpoEnviado = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          id: "pre-1",
          init_point: "https://x",
          status: "pending",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    await criarAssinaturaRecorrente({ ...DADOS, diasTeste: 15 }, espiao);

    const autoRecurring = corpoEnviado.auto_recurring as Record<
      string,
      unknown
    >;
    expect(autoRecurring.free_trial).toEqual({
      frequency: 15,
      frequency_type: "days",
    });
  });

  it("recusa quando a resposta vem sem link de autorização", async () => {
    const resultado = await criarAssinaturaRecorrente(
      DADOS,
      respostaJson({ id: "pre-1", status: "pending" }),
    );
    expect(resultado.ok).toBe(false);
  });

  it("recusa quando o Mercado Pago responde erro", async () => {
    const resultado = await criarAssinaturaRecorrente(
      DADOS,
      respostaJson({ message: "invalid token" }, 401),
    );
    expect(resultado.ok).toBe(false);
  });

  it("timeout ou erro de rede vira recusa, nunca exceção", async () => {
    const resultado = await criarAssinaturaRecorrente(DADOS, foraDoAr);
    expect(resultado.ok).toBe(false);
  });
});

describe("consultarAssinatura", () => {
  it("lê status e referência externa", async () => {
    const resultado = await consultarAssinatura(
      "pre-1",
      respostaJson({
        id: "pre-1",
        status: "authorized",
        external_reference: "ass-1",
      }),
    );
    expect(resultado).toEqual({
      id: "pre-1",
      initPoint: null,
      status: "authorized",
      referenciaExterna: "ass-1",
    });
  });

  it("devolve null quando o Mercado Pago não encontra a assinatura", async () => {
    expect(
      await consultarAssinatura("pre-x", respostaJson({}, 404)),
    ).toBeNull();
  });

  it("timeout ou erro de rede vira null, nunca exceção", async () => {
    expect(await consultarAssinatura("pre-1", foraDoAr)).toBeNull();
  });
});

describe("cancelarAssinaturaNoMercadoPago", () => {
  it("manda status cancelled por PUT", async () => {
    let metodo = "";
    let corpo: Record<string, unknown> = {};
    const espiao = (async (_url: string, init: RequestInit) => {
      metodo = String(init.method);
      corpo = JSON.parse(String(init.body));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const resultado = await cancelarAssinaturaNoMercadoPago("pre-1", espiao);

    expect(resultado.ok).toBe(true);
    expect(metodo).toBe("PUT");
    expect(corpo).toEqual({ status: "cancelled" });
  });

  /**
   * Este é o caso que importa: quem chama só marca a assinatura como
   * cancelada aqui depois de um `ok`. Um erro virando sucesso deixaria a
   * pessoa achando que parou de pagar com a cobrança do mês seguinte
   * ainda programada lá.
   */
  it("erro do Mercado Pago não vira sucesso", async () => {
    const resultado = await cancelarAssinaturaNoMercadoPago(
      "pre-1",
      respostaJson({ message: "not found" }, 404),
    );
    expect(resultado.ok).toBe(false);
  });

  it("timeout ou erro de rede vira recusa, nunca exceção", async () => {
    const resultado = await cancelarAssinaturaNoMercadoPago("pre-1", foraDoAr);
    expect(resultado.ok).toBe(false);
  });
});

describe("consultarParcelaDaAssinatura", () => {
  it("desembrulha o pagamento de dentro da fatura", async () => {
    const resultado = await consultarParcelaDaAssinatura(
      "auth-1",
      respostaJson({
        id: "auth-1",
        preapproval_id: "pre-1",
        transaction_amount: 19.9,
        payment: { id: 987654321, status: "approved" },
      }),
    );

    expect(resultado).toEqual({
      preapprovalId: "pre-1",
      mpPaymentId: "987654321",
      statusPagamento: "approved",
      valorCentavos: 1990,
    });
  });

  /** Fatura programada, ainda sem cobrança gerada. */
  it("sem pagamento dentro, devolve os campos nulos em vez de quebrar", async () => {
    const resultado = await consultarParcelaDaAssinatura(
      "auth-2",
      respostaJson({ id: "auth-2", preapproval_id: "pre-1", payment: null }),
    );
    expect(resultado?.mpPaymentId).toBeNull();
    expect(resultado?.statusPagamento).toBeNull();
  });

  it("sem preapproval_id não dá para saber de qual assinatura é — null", async () => {
    expect(
      await consultarParcelaDaAssinatura("auth-3", respostaJson({ id: "x" })),
    ).toBeNull();
  });

  it("timeout ou erro de rede vira null, nunca exceção", async () => {
    expect(await consultarParcelaDaAssinatura("auth-1", foraDoAr)).toBeNull();
  });
});

describe("consultarPagamento", () => {
  it("lê status e referência externa", async () => {
    const resultado = await consultarPagamento(
      "mp-1",
      respostaJson({
        id: 123,
        status: "approved",
        external_reference: "pag-1",
      }),
    );
    expect(resultado).toEqual({
      id: "123",
      status: "approved",
      referenciaExterna: "pag-1",
    });
  });

  it("devolve null quando o Mercado Pago não encontra o pagamento", async () => {
    const resultado = await consultarPagamento(
      "mp-inexistente",
      respostaJson({ message: "not found" }, 404),
    );
    expect(resultado).toBeNull();
  });

  it("timeout ou erro de rede vira null, nunca exceção", async () => {
    const resultado = await consultarPagamento("mp-1", foraDoAr);
    expect(resultado).toBeNull();
  });
});

describe("validarAssinaturaWebhook", () => {
  const SEGREDO = "segredo-de-teste";

  function assinar(dataId: string, ts: string, requestId: string | null) {
    const manifesto = `id:${dataId};${
      requestId ? `request-id:${requestId};` : ""
    }ts:${ts};`;
    return createHmac("sha256", SEGREDO).update(manifesto).digest("hex");
  }

  it("aceita uma assinatura calculada do jeito certo", () => {
    const ts = "1700000000";
    const v1 = assinar("mp-1", ts, "req-1");
    expect(
      validarAssinaturaWebhook({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: "req-1",
        dataId: "mp-1",
        segredo: SEGREDO,
      }),
    ).toBe(true);
  });

  it("recusa quando o segredo não bate", () => {
    const ts = "1700000000";
    const v1 = assinar("mp-1", ts, "req-1");
    expect(
      validarAssinaturaWebhook({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: "req-1",
        dataId: "mp-1",
        segredo: "outro-segredo",
      }),
    ).toBe(false);
  });

  it("recusa quando o data.id foi trocado", () => {
    const ts = "1700000000";
    const v1 = assinar("mp-1", ts, "req-1");
    expect(
      validarAssinaturaWebhook({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: "req-1",
        dataId: "mp-2",
        segredo: SEGREDO,
      }),
    ).toBe(false);
  });

  it("recusa sem cabeçalho de assinatura", () => {
    expect(
      validarAssinaturaWebhook({
        xSignature: null,
        xRequestId: "req-1",
        dataId: "mp-1",
        segredo: SEGREDO,
      }),
    ).toBe(false);
  });

  it("recusa sem segredo configurado — nunca aceita por padrão", () => {
    const ts = "1700000000";
    const v1 = assinar("mp-1", ts, "req-1");
    expect(
      validarAssinaturaWebhook({
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: "req-1",
        dataId: "mp-1",
        segredo: "",
      }),
    ).toBe(false);
  });

  it("recusa cabeçalho malformado", () => {
    expect(
      validarAssinaturaWebhook({
        xSignature: "isto não é ts=,v1=",
        xRequestId: "req-1",
        dataId: "mp-1",
        segredo: SEGREDO,
      }),
    ).toBe(false);
  });
});
