/**
 * @vitest-environment node
 *
 * A tabela de preços das vagas de empresa (#469, #489).
 *
 * Os valores exatos mudam por decisão, e o primeiro teste trava a tabela de
 * 26/10/2026: mexer num preço exige mexer aqui, de propósito. Os outros
 * guardam a **escada**, que é o que faz a tabela ter sentido: cada plano
 * maior custa mais e cada vaga dele custa menos, e a vaga avulsa fica para
 * quem tem uma só. Uma tabela que viola isso não quebra nada — a tela mostra
 * os números, e a empresa compra o que não devia ou deixa de comprar o que
 * lhe convinha.
 */
import { describe, expect, it } from "vitest";
import {
  CREDITOS_POR_COMPRA,
  ehPlanoDeVaga,
  ehRecorrente,
  PRECO_CENTAVOS,
  planoPorLimite,
  TIPOS_DE_PLANO_DE_VAGA,
  VAGAS_NO_AR_POR_PLANO,
} from "@/server/pagamentos/planos";

const AVULSA = PRECO_CENTAVOS.empresa_vaga_avulsa;
const PLANO_5 = PRECO_CENTAVOS.empresa_plano_5;
const PLANO_10 = PRECO_CENTAVOS.empresa_plano_10;
const ILIMITADO = PRECO_CENTAVOS.empresa_mensal;

describe("tabela de preços das vagas", () => {
  it("é a de 26/10/2026", () => {
    expect(PRECO_CENTAVOS).toMatchObject({
      empresa_vaga_avulsa: 1990,
      empresa_plano_5: 4990,
      empresa_plano_10: 7990,
      empresa_mensal: 9990,
    });
  });

  it("o plano maior custa mais, e cada vaga dele custa menos", () => {
    expect(AVULSA).toBeLessThan(PLANO_5);
    expect(PLANO_5).toBeLessThan(PLANO_10);
    expect(PLANO_10).toBeLessThan(ILIMITADO);

    const porVagaNoPlano5 = PLANO_5 / 5;
    const porVagaNoPlano10 = PLANO_10 / 10;
    expect(AVULSA).toBeGreaterThan(porVagaNoPlano5);
    expect(porVagaNoPlano5).toBeGreaterThan(porVagaNoPlano10);
  });

  /*
   * Onde o plano passa a ganhar de comprar avulsa. Se fosse na segunda vaga
   * ninguém compraria avulsa; se fosse na sexta, ninguém assinaria o Plano
   * 5. A terceira é o ponto: quem contrata uma ou duas por mês fica na
   * avulsa, e quem contrata mais já é cliente de plano.
   */
  it("o Plano 5 passa a valer a pena na terceira vaga", () => {
    expect(2 * AVULSA).toBeLessThan(PLANO_5);
    expect(3 * AVULSA).toBeGreaterThan(PLANO_5);
  });

  /*
   * A válvula do plano cheio: a sexta vaga ocasional sai mais barata pela
   * avulsa do que subindo de plano, e a partir da sétima o Plano 10 já
   * compensa. Sem isso o saldo avulso não teria papel dentro do plano, ou o
   * Plano 10 não teria motivo para existir.
   */
  it("com o Plano 5 cheio, a sexta vaga sai mais barata avulsa; a sétima, no Plano 10", () => {
    expect(PLANO_5 + AVULSA).toBeLessThan(PLANO_10);
    expect(PLANO_5 + 2 * AVULSA).toBeGreaterThan(PLANO_10);
  });

  /*
   * O ilimitado é o teto, e só ganha do Plano 10 para quem precisa de mais
   * de dez vagas no ar. Custar pouco acima do Plano 10 é o que faz o
   * Plano 10 parecer o "meio" da escada sem ser a escolha óbvia.
   */
  it("o ilimitado custa pouco mais que o Plano 10, e não o dobro", () => {
    expect(ILIMITADO).toBeGreaterThan(PLANO_10);
    expect(ILIMITADO).toBeLessThan(PLANO_10 * 2);
  });
});

describe("os planos de vaga", () => {
  it("são três, e cada um tem preço e limite", () => {
    expect(TIPOS_DE_PLANO_DE_VAGA).toEqual([
      "empresa_plano_5",
      "empresa_plano_10",
      "empresa_mensal",
    ]);

    for (const tipo of TIPOS_DE_PLANO_DE_VAGA) {
      expect(PRECO_CENTAVOS[tipo]).toBeGreaterThan(0);
      expect(tipo in VAGAS_NO_AR_POR_PLANO).toBe(true);
    }
  });

  it("o limite cresce de um plano para o outro, e o ilimitado é nulo", () => {
    expect(VAGAS_NO_AR_POR_PLANO.empresa_plano_5).toBe(5);
    expect(VAGAS_NO_AR_POR_PLANO.empresa_plano_10).toBe(10);
    expect(VAGAS_NO_AR_POR_PLANO.empresa_mensal).toBeNull();
  });

  /*
   * Plano é assinatura, não crédito: se algum virasse crédito, a empresa
   * teria o teto do plano e mais um saldo que não pagou.
   */
  it("plano não vira crédito, e só a avulsa vira", () => {
    expect(CREDITOS_POR_COMPRA).toEqual({ empresa_vaga_avulsa: 1 });
    for (const tipo of TIPOS_DE_PLANO_DE_VAGA) {
      expect(tipo in CREDITOS_POR_COMPRA).toBe(false);
    }
  });

  it("os três renovam sozinhos; a avulsa não", () => {
    for (const tipo of TIPOS_DE_PLANO_DE_VAGA) {
      expect(ehRecorrente(tipo)).toBe(true);
      expect(ehPlanoDeVaga(tipo)).toBe(true);
    }
    expect(ehRecorrente("empresa_vaga_avulsa")).toBe(false);
    expect(ehPlanoDeVaga("empresa_vaga_avulsa")).toBe(false);
    expect(ehPlanoDeVaga("prestador_mensalidade")).toBe(false);
  });

  it("o limite guardado na carteira leva de volta ao plano", () => {
    expect(planoPorLimite(5)).toBe("empresa_plano_5");
    expect(planoPorLimite(10)).toBe("empresa_plano_10");
    expect(planoPorLimite(null)).toBe("empresa_mensal");
    expect(planoPorLimite(7)).toBeNull();
  });
});
