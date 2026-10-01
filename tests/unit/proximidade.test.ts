/**
 * @vitest-environment node
 *
 * A escada de proximidade — Issue #79, estendida ao país inteiro na #301.
 *
 * O que se cobra aqui é a ordem dos degraus e o que acontece nas bordas.
 * Ordenação errada não quebra nada: a página carrega, a lista aparece, e o
 * defeito é alguém em Sinop ver uma vaga em Porto Alegre primeiro sem
 * nunca saber por quê. Bug silencioso precisa de teste explícito.
 */
import { describe, expect, it } from "vitest";
import { GRAU, grauDeProximidade, porProximidade } from "@/lib/proximidade";
import { REGIOES } from "@/lib/regioes";

const deSinop = { cidade: "Sinop - MT" };

describe("os degraus, de perto para longe", () => {
  it("a mesma cidade é o mais perto", () => {
    expect(grauDeProximidade(deSinop, { cidade: "Sinop - MT" })).toBe(
      GRAU.MESMA_CIDADE,
    );
  });

  /*
   * Sem degrau de bairro (#321). A escada já começou em "mesmo bairro", e
   * a única coisa que ele fazia era pôr uma vaga do Centro à frente de uma
   * vaga do Jacarandá para quem mora no Centro — o que não existe lista
   * para sustentar fora de Sinop, e que ninguém pediu em lugar nenhum.
   * Se alguém reintroduzir, este teste é o que reprova: o bairro, mesmo
   * que a tela o mande por engano, não pode mexer na ordem.
   */
  it("o bairro não aproxima nem afasta ninguém", () => {
    const origem = { cidade: "Sinop - MT", bairro: "Centro" };
    const doCentro = { cidade: "Sinop - MT", bairro: "Centro" };
    const doJacaranda = { cidade: "Sinop - MT", bairro: "Jacarandá" };

    expect(grauDeProximidade(origem, doCentro)).toBe(
      grauDeProximidade(origem, doJacaranda),
    );
    expect(grauDeProximidade(origem, doCentro)).toBe(GRAU.MESMA_CIDADE);
  });

  /*
   * Cláudia e Santa Carmem estão na região imediata de Sinop — são as
   * cidades de onde a pessoa vem trabalhar em Sinop e para onde vai. É o
   * degrau que justifica a escolha do IBGE em vez de linha reta.
   */
  it("cidade da mesma região imediata", () => {
    for (const cidade of [
      "Cláudia - MT",
      "Santa Carmem - MT",
      "Colíder - MT",
    ]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.MESMA_REGIAO_IMEDIATA,
      );
    }
  });

  it("cidade da mesma região intermediária, outra imediata", () => {
    for (const cidade of [
      "Sorriso - MT",
      "Lucas do Rio Verde - MT",
      "Alta Floresta - MT",
    ]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.MESMA_REGIAO_INTERMEDIARIA,
      );
    }
  });

  it("o outro lado do mesmo estado vem antes de outro estado", () => {
    for (const cidade of ["Cuiabá - MT", "Rondonópolis - MT", "Cáceres - MT"]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.MESMO_ESTADO,
      );
    }
  });

  it("outro estado é o degrau mais longe", () => {
    for (const cidade of [
      "Porto Alegre - RS",
      "São Paulo - SP",
      "Porto Velho - RO",
    ]) {
      expect(grauDeProximidade(deSinop, { cidade }), cidade).toBe(
        GRAU.RESTO_DO_PAIS,
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
      grauDeProximidade(deSinop, { cidade: "Sinop - MT" }),
      grauDeProximidade(deSinop, { cidade: "Cláudia - MT" }),
      grauDeProximidade(deSinop, { cidade: "Sorriso - MT" }),
      grauDeProximidade(deSinop, { cidade: "Cuiabá - MT" }),
      grauDeProximidade(deSinop, { cidade: "São Paulo - SP" }),
    ];
    expect(escada).toEqual([...escada].sort((a, b) => a - b));
    expect(new Set(escada).size).toBe(5);
  });
});

describe("bordas que não podem quebrar a busca", () => {
  it("sem origem, todo mundo empata — a lista volta à ordem antiga", () => {
    for (const origem of [null, undefined, { cidade: "" }]) {
      expect(grauDeProximidade(origem, { cidade: "Sinop - MT" })).toBe(
        GRAU.RESTO_DO_PAIS,
      );
      expect(grauDeProximidade(origem, { cidade: "São Paulo - SP" })).toBe(
        GRAU.RESTO_DO_PAIS,
      );
    }
  });

  /*
   * Dado gravado antes da migração para "Cidade - UF", ou município novo
   * antes de alguém rodar o gerador: sem região, sem estado, e mesmo assim
   * a busca não pode lançar.
   */
  it("cidade fora do mapa cai no último degrau, sem lançar", () => {
    expect(grauDeProximidade(deSinop, { cidade: "Sinop" })).toBe(
      GRAU.RESTO_DO_PAIS,
    );
    expect(
      grauDeProximidade(
        { cidade: "Cidade Nova - MT" },
        { cidade: "Sinop - MT" },
      ),
    ).toBe(GRAU.MESMO_ESTADO);
  });

  it("cidade casa sem depender de acento", () => {
    expect(
      grauDeProximidade({ cidade: "Cuiabá - MT" }, { cidade: "cuiaba - mt" }),
    ).toBe(GRAU.MESMA_CIDADE);
  });

  /*
   * O motivo de a cidade ir com o estado: o mesmo nome em dois estados são
   * duas cidades, e "perto" não pode juntá-las.
   */
  it("nome igual em estados diferentes não é a mesma cidade", () => {
    expect(
      grauDeProximidade(
        { cidade: "Bom Jesus - PI" },
        { cidade: "Bom Jesus - RS" },
      ),
    ).toBe(GRAU.RESTO_DO_PAIS);
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
      { nome: "sao-paulo", cidade: "São Paulo - SP", ordem: 0 },
      { nome: "cuiaba", cidade: "Cuiabá - MT", ordem: 1 },
      { nome: "sorriso", cidade: "Sorriso - MT", ordem: 2 },
      { nome: "sinop", cidade: "Sinop - MT", ordem: 3 },
      { nome: "claudia", cidade: "Cláudia - MT", ordem: 4 },
    ];

    expect(
      [...itens]
        .sort(porProximidade(deSinop, localDe, desempate))
        .map((i) => i.nome),
    ).toEqual(["sinop", "claudia", "sorriso", "cuiaba", "sao-paulo"]);
  });

  /*
   * O desempate é o que preserva o comportamento antigo dentro de cada
   * degrau: vaga continua saindo da mais recente, prestador da melhor nota.
   * Sem isto, "mais perto primeiro" teria embaralhado as duas listas.
   */
  it("dentro do mesmo degrau, quem manda é o desempate", () => {
    const itens: Item[] = [
      { nome: "c", cidade: "Sinop - MT", ordem: 3 },
      { nome: "a", cidade: "Sinop - MT", ordem: 1 },
      { nome: "b", cidade: "Sinop - MT", ordem: 2 },
    ];

    expect(
      [...itens]
        .sort(porProximidade(deSinop, localDe, desempate))
        .map((i) => i.nome),
    ).toEqual(["a", "b", "c"]);
  });

  it("sem origem, a ordem é inteiramente a do desempate", () => {
    const itens: Item[] = [
      { nome: "sao-paulo", cidade: "São Paulo - SP", ordem: 1 },
      { nome: "sinop", cidade: "Sinop - MT", ordem: 2 },
    ];

    expect(
      [...itens]
        .sort(porProximidade(null, localDe, desempate))
        .map((i) => i.nome),
    ).toEqual(["sao-paulo", "sinop"]);
  });
});

/**
 * O mapa gerado, conferido como o de cidades já é.
 *
 * Se o gerador ler o campo errado da API — a intermediária vem aninhada
 * dentro da imediata, não no topo —, o arquivo sai completo e com
 * `undefined` em todas. O script morre nesse caso, mas o arquivo é
 * versionado e pode ser editado à mão apesar do aviso.
 */
describe("o mapa de regiões", () => {
  it("cobre os 5.571 municípios, com as duas regiões preenchidas", () => {
    const entradas = Object.entries(REGIOES);
    expect(entradas).toHaveLength(5571);

    for (const [cidade, regioes] of entradas) {
      expect(regioes, cidade).toHaveLength(2);
      expect(regioes[0], cidade).toBeGreaterThan(0);
      expect(regioes[1], cidade).toBeGreaterThan(0);
    }
  });

  it("tem mais regiões imediatas que intermediárias, como o IBGE define", () => {
    const imediatas = new Set(Object.values(REGIOES).map((r) => r[0]));
    const intermediarias = new Set(Object.values(REGIOES).map((r) => r[1]));

    expect(imediatas.size).toBeGreaterThan(intermediarias.size);
    expect(intermediarias.size).toBeGreaterThan(100);
  });

  it("Sinop e Cláudia dividem a região imediata", () => {
    expect(REGIOES["Sinop - MT"]?.[0]).toBe(REGIOES["Cláudia - MT"]?.[0]);
  });
});
