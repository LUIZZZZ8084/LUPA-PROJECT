/**
 * @vitest-environment node
 *
 * Os estágios da candidatura, ditos para os dois lados.
 *
 * A empresa e o candidato leem o mesmo campo do banco e fazem perguntas
 * diferentes: "o que ainda não olhei?" contra "alguém já olhou o meu?".
 * Por isso `enviada` tem dois nomes — e por isso os outros quatro não têm.
 *
 * O risco que este arquivo cobre é o de alguém renomear um lado só, meses
 * depois, e criar duas telas dizendo coisas diferentes sobre o mesmo
 * estado sem ninguém notar.
 */
import { describe, expect, it } from "vitest";
import {
  APPLICATION_LABELS,
  APPLICATION_LABELS_CANDIDATO,
  APPLICATION_TONE,
} from "@/lib/constants";
import type { ApplicationStatus } from "@/lib/types";

const ESTAGIOS: ApplicationStatus[] = [
  "enviada",
  "visualizada",
  "entrevista",
  "aprovada",
  "rejeitada",
];

describe("os cinco estágios têm nome dos dois lados", () => {
  it.each(ESTAGIOS)("%s tem rótulo para empresa e para candidato", (e) => {
    expect(APPLICATION_LABELS[e]).toBeTruthy();
    expect(APPLICATION_LABELS_CANDIDATO[e]).toBeTruthy();
    expect(APPLICATION_TONE[e]).toBeTruthy();
  });

  /*
   * Nenhum dos três mapas pode ganhar chave que os outros não tenham: um
   * estágio novo no banco precisa aparecer nas duas telas e ter cor, ou
   * alguma delas quebra na hora de renderizar.
   */
  it("os três mapas cobrem exatamente os mesmos estágios", () => {
    const chaves = (o: object) => Object.keys(o).sort();
    expect(chaves(APPLICATION_LABELS)).toEqual(ESTAGIOS.toSorted());
    expect(chaves(APPLICATION_LABELS_CANDIDATO)).toEqual(ESTAGIOS.toSorted());
    expect(chaves(APPLICATION_TONE)).toEqual(ESTAGIOS.toSorted());
  });
});

describe("só `enviada` muda de nome entre os dois lados", () => {
  /**
   * "Nova" responde à pergunta da empresa. Para o candidato não responde
   * nada — a candidatura dele nasceu nova e ele sabe disso. O que ele
   * precisa saber é se alguém abriu.
   */
  it("empresa lê 'Nova', candidato lê 'Não visualizado'", () => {
    expect(APPLICATION_LABELS.enviada).toBe("Nova");
    expect(APPLICATION_LABELS_CANDIDATO.enviada).toBe("Não visualizado");
  });

  /*
   * Os outros quatro descrevem o mesmo fato para quem pergunta as duas
   * coisas — "em triagem" é em triagem dos dois lados. Nome diferente sem
   * pergunta diferente por trás seria só duas pessoas falando de coisas
   * distintas na mesma conversa.
   */
  it.each(ESTAGIOS.filter((e) => e !== "enviada"))(
    "%s se chama igual nos dois lados",
    (e) => {
      expect(APPLICATION_LABELS_CANDIDATO[e]).toBe(APPLICATION_LABELS[e]);
    },
  );
});

/**
 * O vocabulário que o Luiz usa, e que a empresa marca no painel. Trava os
 * nomes: "Aprovada" e "Não selecionado" diziam a mesma coisa com outras
 * palavras, e a volta silenciosa para elas desalinharia a tela do que foi
 * combinado.
 */
describe("o vocabulário combinado", () => {
  it.each([
    ["visualizada", "Em triagem"],
    ["aprovada", "Selecionado"],
    ["rejeitada", "Reprovado"],
  ] as const)("%s se chama '%s'", (estagio, nome) => {
    expect(APPLICATION_LABELS[estagio]).toBe(nome);
  });
});
