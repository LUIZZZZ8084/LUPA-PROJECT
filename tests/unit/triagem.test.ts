/**
 * Perguntas de triagem: o que é "atender" (#491).
 *
 * A regra mora num arquivo compartilhado entre servidor e cliente porque a
 * tela de quem se candidata, a lista da empresa e o serviço precisam concordar
 * — e o que se protege aqui é o erro que não derruba nada: separar no grupo
 * errado quem respondeu certo.
 */
import { describe, expect, it } from "vitest";
import {
  atendeAoQueAVagaExige,
  MAXIMO_DE_PERGUNTAS,
  motivosDeNaoAtender,
  type PerguntaDeTriagem,
  perguntasValidas,
  respostasValidas,
} from "@/lib/triagem";

const CNH: PerguntaDeTriagem = { texto: "Tem CNH D?", eliminatoria: true };
const NOITE: PerguntaDeTriagem = {
  texto: "Pode trabalhar à noite?",
  eliminatoria: false,
};
const VIAJAR: PerguntaDeTriagem = {
  texto: "Pode viajar?",
  eliminatoria: true,
};

describe("atendeAoQueAVagaExige", () => {
  it("vaga sem pergunta: todo mundo atende", () => {
    expect(atendeAoQueAVagaExige([], null)).toBe(true);
    expect(atendeAoQueAVagaExige([], [])).toBe(true);
  });

  it("respondeu Sim a toda eliminatória: atende", () => {
    expect(
      atendeAoQueAVagaExige([CNH, NOITE, VIAJAR], [true, false, true]),
    ).toBe(true);
  });

  it("respondeu Não a uma eliminatória: não atende", () => {
    expect(atendeAoQueAVagaExige([CNH, NOITE], [false, true])).toBe(false);
  });

  /**
   * Informativa só informa: a resposta chega à empresa e não muda o grupo de
   * ninguém. Se mudasse, "Pode trabalhar à noite?" seria eliminatória sem
   * a empresa ter marcado.
   */
  it("Não numa informativa não tira ninguém do grupo", () => {
    expect(atendeAoQueAVagaExige([CNH, NOITE], [true, false])).toBe(true);
  });

  /**
   * Numa vaga com pergunta eliminatória, "não sabemos" não é "atende". Cobre
   * o que nunca devia existir (a candidatura de uma vaga com pergunta sem a
   * lista), e é o lado seguro de errar.
   */
  it("sem a lista de respostas, não atende uma vaga que exige", () => {
    expect(atendeAoQueAVagaExige([CNH], null)).toBe(false);
    expect(atendeAoQueAVagaExige([CNH], undefined)).toBe(false);
    expect(atendeAoQueAVagaExige([CNH, VIAJAR], [true])).toBe(false);
  });

  it("sem a lista, vaga só com informativas continua atendendo", () => {
    expect(atendeAoQueAVagaExige([NOITE], null)).toBe(true);
  });
});

describe("motivosDeNaoAtender", () => {
  it("devolve o texto de cada eliminatória respondida Não, na ordem", () => {
    expect(
      motivosDeNaoAtender([CNH, NOITE, VIAJAR], [false, false, false]),
    ).toEqual(["Tem CNH D?", "Pode viajar?"]);
  });

  it("quem atende não tem motivo nenhum", () => {
    expect(motivosDeNaoAtender([CNH, VIAJAR], [true, true])).toEqual([]);
  });
});

describe("perguntasValidas", () => {
  it("aceita o que o banco devolve", () => {
    expect(perguntasValidas([CNH, NOITE])).toEqual([CNH, NOITE]);
  });

  it("não é lista: vira vazio", () => {
    expect(perguntasValidas(null)).toEqual([]);
    expect(perguntasValidas("lixo")).toEqual([]);
    expect(perguntasValidas({ texto: "x" })).toEqual([]);
  });

  it("descarta item sem texto e corta em três", () => {
    const bruto = [
      { texto: "A?" },
      { eliminatoria: true },
      null,
      7,
      { texto: "B?", eliminatoria: true },
      { texto: "C?" },
      { texto: "D?" },
    ];

    const lista = perguntasValidas(bruto);

    expect(lista.map((p) => p.texto)).toEqual(["A?", "B?", "C?"]);
    expect(lista).toHaveLength(MAXIMO_DE_PERGUNTAS);
  });

  /** Só `true` de verdade é eliminatória: "sim" ou 1 no jsonb não conta. */
  it("eliminatória é um booleano verdadeiro, e nada mais", () => {
    expect(
      perguntasValidas([
        { texto: "A?", eliminatoria: "true" },
        { texto: "B?", eliminatoria: 1 },
        { texto: "C?", eliminatoria: true },
      ]).map((p) => p.eliminatoria),
    ).toEqual([false, false, true]);
  });
});

describe("respostasValidas", () => {
  it("aceita lista de verdadeiro e falso", () => {
    expect(respostasValidas([true, false])).toEqual([true, false]);
    expect(respostasValidas([])).toEqual([]);
  });

  it("recusa o que não é lista ou tem item que não é booleano", () => {
    expect(respostasValidas(null)).toBeNull();
    expect(respostasValidas("sim")).toBeNull();
    expect(respostasValidas([true, "sim"])).toBeNull();
    expect(respostasValidas([1, 0])).toBeNull();
  });
});
