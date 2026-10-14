/**
 * @vitest-environment node
 *
 * A tabela de preços das vagas de empresa (#469).
 *
 * Os valores exatos mudam por decisão, e o primeiro teste trava a tabela de
 * 14/10/2026: mexer num preço exige mexer aqui, de propósito. Os outros
 * guardam a **escada**, que é o que faz a tabela ter sentido: unitário que cai
 * com o pacote maior, e o plano mensal como teto. Uma tabela que viola isso
 * não quebra nada — a tela mostra os números, e a empresa compra o que não
 * devia ou deixa de comprar o que lhe convinha.
 */
import { describe, expect, it } from "vitest";
import {
  CREDITOS_POR_COMPRA,
  PRECO_CENTAVOS,
} from "@/server/pagamentos/planos";

const PACOTES = [
  "empresa_vaga_avulsa",
  "empresa_pacote_5",
  "empresa_pacote_10",
] as const;

function porVaga(tipo: (typeof PACOTES)[number]) {
  return PRECO_CENTAVOS[tipo] / (CREDITOS_POR_COMPRA[tipo] ?? 1);
}

/** O menor gasto para ter `vagas` vagas, combinando os três pacotes. */
function menorGasto(vagas: number) {
  const gasto = [0];
  for (let n = 1; n <= vagas; n++) {
    gasto[n] = Math.min(
      ...PACOTES.map((tipo) => {
        const creditos = CREDITOS_POR_COMPRA[tipo] ?? 1;
        return PRECO_CENTAVOS[tipo] + gasto[Math.max(0, n - creditos)];
      }),
    );
  }
  return gasto[vagas];
}

describe("tabela de preços das vagas", () => {
  it("é a de 14/10/2026", () => {
    expect(PRECO_CENTAVOS).toMatchObject({
      empresa_vaga_avulsa: 1990,
      empresa_pacote_5: 7990,
      empresa_pacote_10: 9990,
      empresa_mensal: 14990,
    });
  });

  it("o pacote maior custa mais, e cada vaga dele custa menos", () => {
    expect(PRECO_CENTAVOS.empresa_vaga_avulsa).toBeLessThan(
      PRECO_CENTAVOS.empresa_pacote_5,
    );
    expect(PRECO_CENTAVOS.empresa_pacote_5).toBeLessThan(
      PRECO_CENTAVOS.empresa_pacote_10,
    );

    expect(porVaga("empresa_vaga_avulsa")).toBeGreaterThan(
      porVaga("empresa_pacote_5"),
    );
    expect(porVaga("empresa_pacote_5")).toBeGreaterThan(
      porVaga("empresa_pacote_10"),
    );
  });

  it("o plano mensal é o teto: custa mais que o maior pacote", () => {
    expect(PRECO_CENTAVOS.empresa_mensal).toBeGreaterThan(
      PRECO_CENTAVOS.empresa_pacote_10,
    );
  });

  /*
   * Onde o mensal começa a ganhar de comprar vaga por vaga. Antes de dez ele
   * não pode ganhar do pacote de 10, senão ninguém compra pacote; e não
   * pode demorar demais, senão o mensal é um plano que ninguém alcança.
   */
  it("o mensal passa a valer a pena depois do pacote de 10, e não muito depois", () => {
    let a_partir_de = 0;
    for (let n = 1; n <= 60; n++) {
      if (PRECO_CENTAVOS.empresa_mensal <= menorGasto(n)) {
        a_partir_de = n;
        break;
      }
    }

    expect(a_partir_de, "o mensal nunca ganha em 60 vagas").toBeGreaterThan(0);
    expect(a_partir_de).toBeGreaterThan(10);
    expect(a_partir_de).toBeLessThanOrEqual(20);
  });
});
