/**
 * @vitest-environment node
 *
 * A escada de proximidade — Issue #79.
 *
 * O que se cobra aqui é a ordem dos degraus e o que acontece nas bordas.
 * Ordenação errada não quebra nada: a página carrega, a lista aparece, e o
 * defeito é alguém em Sinop ver Cuiabá primeiro sem nunca saber por quê.
 * Bug silencioso precisa de teste explícito.
 */
import { describe, expect, it } from "vitest";
import {
  GRAU,
  grauDeProximidade,
  type Local,
  porProximidade,
} from "@/lib/proximidade";
import { REGIOES_MT } from "@/lib/regioes-mt";

const deSinop = { cidade: "Sinop", bairro: "Centro" };

describe("os degraus, de perto para longe", () => {
  it("mesmo bairro da mesma cidade é o mais perto", () => {
    expect(
      grauDeProximidade(deSinop, { cidade: "Sinop", bairro: "Centro" }),
    ).toBe(GRAU.MESMO_BAIRRO);
  });

  it("mesma cidade, outro bairro", () => {
    expect(
      grauDeProximidade(deSinop, { cidade: "Sinop", bairro: "Jacarandá" }),
    ).toBe(GRAU.MESMA_CIDADE);
  });

  /*
   * Cláudia e Santa Carmem estão na região imediata de Sinop — são as
   * cidades de onde a pessoa vem trabalhar em Sinop e para onde vai. É o
   * degrau que justifica a escolha do IBGE em vez de linha reta.
   */
  it("cidade da mesma região imediata", () => {
    for (const cidade of ["Cláudia", "Santa Carmem", "Colíder"]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.MESMA_REGIAO_IMEDIATA,
      );
    }
  });

  it("cidade da mesma região intermediária, outra imediata", () => {
    for (const cidade of ["Sorriso", "Lucas do Rio Verde", "Alta Floresta"]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.MESMA_REGIAO_INTERMEDIARIA,
      );
    }
  });

  it("o outro lado do estado é o degrau mais longe", () => {
    for (const cidade of ["Cuiabá", "Rondonópolis", "Cáceres"]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.RESTO_DO_ESTADO,
      );
    }
  });

  /*
   * A ordem dos degraus é o contrato inteiro. Um deles fora de lugar e a
   * lista inverte sem que nenhum teste acima falhe — cada um deles afirma
   * só o seu próprio valor.
   */
  it("os degraus estão em ordem crescente de distância", () => {
    const escada = [
      grauDeProximidade(deSinop, { cidade: "Sinop", bairro: "Centro" }),
      grauDeProximidade(deSinop, { cidade: "Sinop", bairro: "Menezes" }),
      grauDeProximidade(deSinop, { cidade: "Cláudia" }),
      grauDeProximidade(deSinop, { cidade: "Sorriso" }),
      grauDeProximidade(deSinop, { cidade: "Cuiabá" }),
    ];
    expect(escada).toEqual([...escada].sort((a, b) => a - b));
    expect(new Set(escada).size).toBe(5);
  });
});

describe("bordas que não podem quebrar a busca", () => {
  it("sem origem, todo mundo empata — a lista volta à ordem antiga", () => {
    for (const origem of [null, undefined, { cidade: "" }]) {
      expect(grauDeProximidade(origem, { cidade: "Sinop" })).toBe(
        GRAU.RESTO_DO_ESTADO,
      );
      expect(grauDeProximidade(origem, { cidade: "Cuiabá" })).toBe(
        GRAU.RESTO_DO_ESTADO,
      );
    }
  });

  it("cidade fora do mapa cai no último degrau, sem lançar", () => {
    expect(grauDeProximidade(deSinop, { cidade: "Curitiba" })).toBe(
      GRAU.RESTO_DO_ESTADO,
    );
    expect(grauDeProximidade({ cidade: "Curitiba" }, { cidade: "Sinop" })).toBe(
      GRAU.RESTO_DO_ESTADO,
    );
  });

  it("sem bairro dos dois lados, para na cidade e não confunde com bairro", () => {
    expect(grauDeProximidade({ cidade: "Sinop" }, { cidade: "Sinop" })).toBe(
      GRAU.MESMA_CIDADE,
    );
    expect(
      grauDeProximidade(
        { cidade: "Sinop", bairro: null },
        { cidade: "Sinop", bairro: null },
      ),
    ).toBe(GRAU.MESMA_CIDADE);
  });

  /*
   * Bairro é texto livre fora de Sinop, e mesmo em Sinop chega do banco
   * como veio. "Jardim Botânico" e "jardim botanico" são o mesmo lugar; se
   * não fossem, o degrau mais perto simplesmente nunca aconteceria para
   * quem digitou sem acento — que é metade do público.
   */
  it("bairro casa sem depender de acento ou maiúscula", () => {
    expect(
      grauDeProximidade(
        { cidade: "Sinop", bairro: "Jardim Botânico" },
        { cidade: "Sinop", bairro: "jardim botanico" },
      ),
    ).toBe(GRAU.MESMO_BAIRRO);
  });

  it("cidade casa sem depender de acento", () => {
    expect(grauDeProximidade({ cidade: "Cuiabá" }, { cidade: "cuiaba" })).toBe(
      GRAU.MESMA_CIDADE,
    );
  });
});

describe("prestador: perto é onde ele atende", () => {
  /*
   * O eletricista mora no Jacarandá e atende o Centro. Para quem é do
   * Centro ele está perto — usar o endereço dele responderia a pergunta
   * errada, que é "quem vem até mim", não "quem mora ao meu lado".
   */
  it("atender o bairro da pessoa vale como mesmo bairro", () => {
    const local: Local = {
      cidade: "Sinop",
      bairro: "Jacarandá",
      atende: ["Centro", "Jardim Itália"],
    };
    expect(grauDeProximidade(deSinop, local)).toBe(GRAU.MESMO_BAIRRO);
  });

  it("atender outro bairro não aproxima mais que a cidade", () => {
    const local: Local = {
      cidade: "Sinop",
      bairro: "Jacarandá",
      atende: ["Menezes"],
    };
    expect(grauDeProximidade(deSinop, local)).toBe(GRAU.MESMA_CIDADE);
  });

  it("bairro atendido em outra cidade não aproxima nada", () => {
    const local: Local = { cidade: "Cuiabá", atende: ["Centro"] };
    expect(grauDeProximidade(deSinop, local)).toBe(GRAU.RESTO_DO_ESTADO);
  });
});

describe("o comparador", () => {
  interface Item {
    nome: string;
    cidade: string;
    ordem: number;
  }

  const desempate = (a: Item, b: Item) => a.ordem - b.ordem;
  const localDe = (i: Item) => ({ cidade: i.cidade });

  it("põe o mais perto primeiro, ignorando o desempate", () => {
    const itens: Item[] = [
      { nome: "cuiaba", cidade: "Cuiabá", ordem: 1 },
      { nome: "sorriso", cidade: "Sorriso", ordem: 2 },
      { nome: "sinop", cidade: "Sinop", ordem: 3 },
      { nome: "claudia", cidade: "Cláudia", ordem: 4 },
    ];

    expect(
      [...itens]
        .sort(porProximidade(deSinop, localDe, desempate))
        .map((i) => i.nome),
    ).toEqual(["sinop", "claudia", "sorriso", "cuiaba"]);
  });

  /*
   * O desempate é o que preserva o comportamento antigo dentro de cada
   * degrau: vaga continua saindo da mais recente, prestador da melhor nota.
   * Sem isto, "mais perto primeiro" teria embaralhado as duas listas.
   */
  it("dentro do mesmo degrau, quem manda é o desempate", () => {
    const itens: Item[] = [
      { nome: "c", cidade: "Sinop", ordem: 3 },
      { nome: "a", cidade: "Sinop", ordem: 1 },
      { nome: "b", cidade: "Sinop", ordem: 2 },
    ];

    expect(
      [...itens]
        .sort(porProximidade(deSinop, localDe, desempate))
        .map((i) => i.nome),
    ).toEqual(["a", "b", "c"]);
  });

  it("sem origem, a ordem é inteiramente a do desempate", () => {
    const itens: Item[] = [
      { nome: "cuiaba", cidade: "Cuiabá", ordem: 1 },
      { nome: "sinop", cidade: "Sinop", ordem: 2 },
    ];

    expect(
      [...itens]
        .sort(porProximidade(null, localDe, desempate))
        .map((i) => i.nome),
    ).toEqual(["cuiaba", "sinop"]);
  });
});

/**
 * O mapa gerado, conferido como o de cidades já é.
 *
 * Se o gerador ler o campo errado da API — a intermediária vem aninhada
 * dentro da imediata, não no topo —, o arquivo sai com 142 entradas e
 * `undefined` em todas. O script morre nesse caso, mas o arquivo é
 * versionado e pode ser editado à mão apesar do aviso.
 */
describe("o mapa de regiões", () => {
  it("cobre os 142 municípios, com as duas regiões preenchidas", () => {
    const entradas = Object.entries(REGIOES_MT);
    expect(entradas).toHaveLength(142);

    for (const [cidade, regioes] of entradas) {
      expect(regioes, cidade).toHaveLength(2);
      expect(regioes[0]?.length, cidade).toBeGreaterThan(2);
      expect(regioes[1]?.length, cidade).toBeGreaterThan(2);
    }
  });

  it("tem mais regiões imediatas que intermediárias, como o IBGE define", () => {
    const imediatas = new Set(Object.values(REGIOES_MT).map((r) => r[0]));
    const intermediarias = new Set(Object.values(REGIOES_MT).map((r) => r[1]));

    expect(imediatas.size).toBeGreaterThan(intermediarias.size);
    expect(intermediarias.size).toBeGreaterThan(1);
  });

  it("Sinop é sede das duas regiões dela", () => {
    expect(REGIOES_MT.Sinop).toEqual(["Sinop", "Sinop"]);
  });
});
