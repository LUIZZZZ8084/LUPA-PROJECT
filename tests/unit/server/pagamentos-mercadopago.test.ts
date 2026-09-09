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
  consultarPagamento,
  criarPreferencia,
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

describe("criarPreferencia", () => {
  it("devolve id e link de checkout numa resposta válida", async () => {
    const resultado = await criarPreferencia(
      {
        titulo: "Mensalidade de prestador — Lupa",
        valorCentavos: 2490,
        referenciaExterna: "pag-1",
        urlRetorno: "https://lupa.app/pagamento/retorno?id=pag-1",
        urlWebhook: "https://lupa.app/api/webhooks/mercado-pago",
      },
      respostaJson({
        id: "pref-123",
        init_point: "https://mercadopago.com/checkout/pref-123",
      }),
    );

    expect(resultado).toEqual({
      ok: true,
      preferencia: {
        id: "pref-123",
        initPoint: "https://mercadopago.com/checkout/pref-123",
      },
    });
  });

  it("recusa quando a resposta não tem os campos esperados", async () => {
    const resultado = await criarPreferencia(
      {
        titulo: "x",
        valorCentavos: 100,
        referenciaExterna: "pag-1",
        urlRetorno: "https://lupa.app/retorno",
        urlWebhook: "https://lupa.app/webhook",
      },
      respostaJson({}),
    );
    expect(resultado.ok).toBe(false);
  });

  it("recusa quando o Mercado Pago responde erro", async () => {
    const resultado = await criarPreferencia(
      {
        titulo: "x",
        valorCentavos: 100,
        referenciaExterna: "pag-1",
        urlRetorno: "https://lupa.app/retorno",
        urlWebhook: "https://lupa.app/webhook",
      },
      respostaJson({ message: "invalid token" }, 401),
    );
    expect(resultado.ok).toBe(false);
  });

  it("timeout ou erro de rede vira recusa, nunca exceção", async () => {
    const resultado = await criarPreferencia(
      {
        titulo: "x",
        valorCentavos: 100,
        referenciaExterna: "pag-1",
        urlRetorno: "https://lupa.app/retorno",
        urlWebhook: "https://lupa.app/webhook",
      },
      foraDoAr,
    );
    expect(resultado.ok).toBe(false);
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
