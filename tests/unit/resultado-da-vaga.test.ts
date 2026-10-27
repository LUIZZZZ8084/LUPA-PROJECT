/**
 * O resultado de cada vaga (#492).
 *
 * É conta de contagem, e o que se protege é o número que a empresa lê — com
 * uma regra que não aparece na tela quando está certa: **zero é uma
 * afirmação**. "0 muito compatíveis" diz "comparei, e ninguém combina"; vaga
 * que não declara habilidade, ou candidato que não declarou nenhuma, não
 * permite comparar, e a linha não menciona o número em vez de mentir.
 */
import { describe, expect, it } from "vitest";
import {
  LIMIAR_MUITO_COMPATIVEL,
  resultadosDasVagas,
} from "@/lib/resultado-da-vaga";

const vagas = [
  { id: "v1", applicant_count: 3 },
  { id: "v2", applicant_count: 2 },
  { id: "v3", applicant_count: 0 },
];

const candidaturas = [
  { id: "c1", job_id: "v1" },
  { id: "c2", job_id: "v1" },
  { id: "c3", job_id: "v1" },
  { id: "c4", job_id: "v2" },
  { id: "c5", job_id: "v2" },
];

describe("resultadosDasVagas", () => {
  it("junta visualizações, candidaturas e quantas combinam, por vaga", () => {
    const r = resultadosDasVagas(
      vagas,
      candidaturas,
      new Map([
        ["c1", { porcentagem: 100 }],
        ["c2", { porcentagem: 70 }],
        ["c3", { porcentagem: 40 }],
      ]),
      new Map([["v1", 120]]),
    );

    expect(r.get("v1")).toEqual({
      visualizacoes: 120,
      candidaturas: 3,
      muitoCompativeis: 2,
    });
  });

  /** O mesmo corte do selo verde da lista de currículos. */
  it("o corte é 70%: 70 conta, 69 não", () => {
    expect(LIMIAR_MUITO_COMPATIVEL).toBe(70);

    const r = resultadosDasVagas(
      [{ id: "v1", applicant_count: 2 }],
      [
        { id: "c1", job_id: "v1" },
        { id: "c2", job_id: "v1" },
      ],
      new Map([
        ["c1", { porcentagem: 70 }],
        ["c2", { porcentagem: 69 }],
      ]),
      new Map(),
    );

    expect(r.get("v1")?.muitoCompativeis).toBe(1);
  });

  /**
   * Zero é uma afirmação: se dá para comparar e ninguém combina, é zero de
   * verdade.
   */
  it("comparou e ninguém combina: zero, de verdade", () => {
    const r = resultadosDasVagas(
      [{ id: "v1", applicant_count: 1 }],
      [{ id: "c1", job_id: "v1" }],
      new Map([["c1", { porcentagem: 20 }]]),
      new Map(),
    );

    expect(r.get("v1")?.muitoCompativeis).toBe(0);
  });

  it("não dá para comparar ninguém: o número não aparece, e não vira zero", () => {
    const r = resultadosDasVagas(vagas, candidaturas, new Map(), new Map());

    expect(r.get("v2")?.muitoCompativeis).toBeNull();
    expect(r.get("v3")?.muitoCompativeis).toBeNull();
  });

  it("só entra na conta quem dá para comparar", () => {
    const r = resultadosDasVagas(
      vagas,
      candidaturas,
      // c4 sem habilidade declarada: fora do mapa de casamento.
      new Map([["c5", { porcentagem: 90 }]]),
      new Map(),
    );

    expect(r.get("v2")).toMatchObject({
      candidaturas: 2,
      muitoCompativeis: 1,
    });
  });

  it("vaga sem visita tem zero visualizações, que aqui é verdade", () => {
    const r = resultadosDasVagas(vagas, candidaturas, new Map(), new Map());

    expect(r.get("v3")?.visualizacoes).toBe(0);
  });

  it("não mistura as vagas", () => {
    const r = resultadosDasVagas(
      vagas,
      candidaturas,
      new Map([["c1", { porcentagem: 100 }]]),
      new Map([
        ["v1", 10],
        ["v2", 20],
      ]),
    );

    expect(r.get("v1")?.visualizacoes).toBe(10);
    expect(r.get("v2")?.visualizacoes).toBe(20);
    expect(r.get("v2")?.muitoCompativeis).toBeNull();
  });
});
