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
import {
  cidadeDaBusca,
  filtrosDeLugar,
  lugarDaBusca,
  ufDaBusca,
  umParametro,
} from "@/lib/busca";

describe("umParametro", () => {
  it("devolve o valor quando vem um só", () => {
    expect(umParametro({ cidade: "Sinop - MT" }, "cidade")).toBe("Sinop - MT");
  });

  /*
   * `?cidade=Sinop&cidade=Sorriso` é URL válida e chega como array. Sem
   * este cuidado o filtro receberia a lista onde espera texto, nunca
   * casaria com cidade nenhuma, e a busca voltaria vazia sem nada na tela
   * explicando o motivo.
   */
  it("fica com o primeiro quando a URL repete o parâmetro", () => {
    expect(
      umParametro({ cidade: ["Sinop - MT", "Sorriso - MT"] }, "cidade"),
    ).toBe("Sinop - MT");
  });

  it("devolve undefined para o que não veio", () => {
    expect(umParametro({}, "cidade")).toBeUndefined();
    expect(umParametro({ cidade: undefined }, "cidade")).toBeUndefined();
    expect(umParametro({ cidade: [] }, "cidade")).toBeUndefined();
  });
});

describe("cidadeDaBusca", () => {
  it("aceita município de qualquer estado", () => {
    expect(cidadeDaBusca({ cidade: "São Paulo - SP" })).toBe("São Paulo - SP");
    expect(cidadeDaBusca({ cidade: "Sorriso - MT" })).toBe("Sorriso - MT");
    expect(
      cidadeDaBusca({ cidade: "Vila Bela da Santíssima Trindade - MT" }),
    ).toBe("Vila Bela da Santíssima Trindade - MT");
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
  it("recusa o que não é município do Brasil, com o estado", () => {
    for (const cidade of [
      "Curitiba",
      "sinop",
      "Sinop",
      "Sinop-MT",
      "<script>alert(1)</script>",
      "Vagas de graça — clique aqui",
    ]) {
      expect(cidadeDaBusca({ cidade }), cidade).toBeUndefined();
    }
  });

  it("cidade repetida na URL usa a primeira, e ainda valida", () => {
    expect(cidadeDaBusca({ cidade: ["Sorriso - MT", "Curitiba"] })).toBe(
      "Sorriso - MT",
    );
    expect(
      cidadeDaBusca({ cidade: ["Curitiba", "Sorriso - MT"] }),
    ).toBeUndefined();
  });
});

/**
 * Estado e cidade, coerentes entre si (#301).
 */
describe("ufDaBusca", () => {
  it("aceita sigla de estado, em qualquer caixa", () => {
    expect(ufDaBusca({ uf: "MT" })).toBe("MT");
    expect(ufDaBusca({ uf: "sp" })).toBe("SP");
  });

  it("recusa o que não é sigla de estado", () => {
    for (const uf of ["XX", "Mato Grosso", "<b>", ""]) {
      expect(ufDaBusca({ uf }), uf).toBeUndefined();
    }
  });
});

describe("lugarDaBusca", () => {
  it("link só com a cidade acha o estado sozinho", () => {
    expect(lugarDaBusca({ cidade: "Sorriso - MT" })).toEqual({
      uf: "MT",
      cidade: "Sorriso - MT",
    });
  });

  /*
   * Cidade de um estado com outro estado escolhido: o filtro nunca casaria,
   * e a tela diria "nenhuma vaga" sem explicar por quê.
   */
  it("cidade de outro estado é descartada, e o estado escolhido vale", () => {
    expect(lugarDaBusca({ uf: "SP", cidade: "Sorriso - MT" })).toEqual({
      uf: "SP",
      cidade: undefined,
    });
  });

  it("sem nada na URL, a busca é do Brasil inteiro", () => {
    expect(lugarDaBusca({})).toEqual({ uf: undefined, cidade: undefined });
  });
});

describe("filtrosDeLugar", () => {
  it("sem estado, só o filtro de estado — nada de 5.571 cidades na página", () => {
    const filtros = filtrosDeLugar(undefined);
    expect(filtros.map((f) => f.key)).toEqual(["uf"]);
    expect(filtros[0]?.options).toHaveLength(27);
  });

  it("com estado, as cidades dele, e trocar o estado solta a cidade", () => {
    const [uf, cidade] = filtrosDeLugar("MT");
    expect(uf?.limpa).toEqual(["cidade"]);
    expect(cidade?.options).toHaveLength(142);
    expect(cidade?.options).toContainEqual({
      value: "Sinop - MT",
      label: "Sinop",
    });
  });
});
