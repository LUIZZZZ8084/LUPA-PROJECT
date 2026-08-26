/**
 * @vitest-environment node
 *
 * Leitura dos parâmetros de busca — Issues #78 e #79.
 *
 * Estas duas funções são pequenas e valem teste porque o que sai delas vai
 * para dois lugares de consequência diferente: o filtro da consulta, onde
 * valor ruim só devolve lista vazia, e o `<title>` da página, que vira
 * prévia de link compartilhado.
 */
import { describe, expect, it } from "vitest";
import { cidadeDaBusca, umParametro } from "@/lib/busca";

describe("umParametro", () => {
  it("devolve o valor quando vem um só", () => {
    expect(umParametro({ cidade: "Sinop" }, "cidade")).toBe("Sinop");
  });

  /*
   * `?cidade=Sinop&cidade=Sorriso` é URL válida e chega como array. Sem
   * este cuidado o filtro receberia a lista onde espera texto, nunca
   * casaria com cidade nenhuma, e a busca voltaria vazia sem nada na tela
   * explicando o motivo.
   */
  it("fica com o primeiro quando a URL repete o parâmetro", () => {
    expect(umParametro({ cidade: ["Sinop", "Sorriso"] }, "cidade")).toBe(
      "Sinop",
    );
  });

  it("devolve undefined para o que não veio", () => {
    expect(umParametro({}, "cidade")).toBeUndefined();
    expect(umParametro({ cidade: undefined }, "cidade")).toBeUndefined();
    expect(umParametro({ cidade: [] }, "cidade")).toBeUndefined();
  });
});

describe("cidadeDaBusca", () => {
  it("aceita município de Mato Grosso", () => {
    expect(cidadeDaBusca({ cidade: "Sorriso" })).toBe("Sorriso");
    expect(cidadeDaBusca({ cidade: "Vila Bela da Santíssima Trindade" })).toBe(
      "Vila Bela da Santíssima Trindade",
    );
  });

  it("sem cidade na URL, devolve undefined", () => {
    expect(cidadeDaBusca({})).toBeUndefined();
    expect(cidadeDaBusca({ cidade: "" })).toBeUndefined();
  });

  /*
   * O valor vai para o título da página. Ele não executa nada — o React
   * escapa —, mas página que ecoa qualquer texto da URL no próprio título
   * é como se monta uma isca com um domínio em que a pessoa confia. A
   * lista fechada de municípios já era a validação; aqui ela passa a valer
   * também para o que é anunciado.
   */
  it("recusa o que não é município do estado", () => {
    for (const cidade of [
      "Curitiba",
      "sinop",
      "Sinop - MT",
      "<script>alert(1)</script>",
      "Vagas de graça — clique aqui",
    ]) {
      expect(cidadeDaBusca({ cidade }), cidade).toBeUndefined();
    }
  });

  it("cidade repetida na URL usa a primeira, e ainda valida", () => {
    expect(cidadeDaBusca({ cidade: ["Sorriso", "Curitiba"] })).toBe("Sorriso");
    expect(cidadeDaBusca({ cidade: ["Curitiba", "Sorriso"] })).toBeUndefined();
  });
});
