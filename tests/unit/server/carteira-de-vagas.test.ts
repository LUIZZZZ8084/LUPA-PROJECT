/**
 * @vitest-environment node
 *
 * A carteira de quem publica vaga (#172).
 *
 * Publicar era de graça e sem limite. O que se protege aqui são as duas
 * pontas dessa mudança: que ninguém publique sem ter pago, e que ninguém
 * pague sem receber — as duas falham em silêncio, e a segunda só aparece
 * quando alguém confere a receita no fim do mês.
 *
 * O caso que mais importa é o último do arquivo: **reativar consome
 * crédito**. Sem isso a cobrança inteira vira teatro — a empresa compra
 * uma vaga e a renova para sempre, que é a vaga fantasma paga uma vez.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

import {
  RepositorioCarteirasMemoria,
  usarRepositorioCarteiras,
} from "@/server/carteiras";
import {
  creditarVagas,
  debitarVagas,
  devolverCredito,
  direitoDePublicar,
  estenderPlanoMensal,
  gastarParaPublicar,
  revogarPlanoMensal,
} from "@/server/carteiras/servico";

const PESSOA = "empresa-1";

describe("carteira de vagas", () => {
  let repo: RepositorioCarteirasMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioCarteirasMemoria();
    restaurar = usarRepositorioCarteiras(repo);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  it("quem nunca comprou nada não pode publicar", async () => {
    const direito = await direitoDePublicar(PESSOA);

    expect(direito.pode).toBe(false);
    expect(direito.creditos).toBe(0);
    expect(direito.mensalAtivo).toBe(false);
  });

  it("comprar crédito libera a publicação", async () => {
    await creditarVagas(PESSOA, 5);

    const direito = await direitoDePublicar(PESSOA);
    expect(direito.pode).toBe(true);
    expect(direito.creditos).toBe(5);
  });

  it("publicar gasta um crédito, e só um", async () => {
    await creditarVagas(PESSOA, 5);

    expect(await gastarParaPublicar(PESSOA)).toBe(true);

    expect((await direitoDePublicar(PESSOA)).creditos).toBe(4);
  });

  /**
   * O portão. Sem ele, a cobrança não existe de fato — a tela cobraria e
   * o servidor deixaria passar assim mesmo.
   */
  it("sem crédito nenhum, não publica", async () => {
    expect(await gastarParaPublicar(PESSOA)).toBe(false);
  });

  it("gastar o último crédito zera, e o próximo é recusado", async () => {
    await creditarVagas(PESSOA, 1);

    expect(await gastarParaPublicar(PESSOA)).toBe(true);
    expect(await gastarParaPublicar(PESSOA)).toBe(false);
    expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
  });

  /**
   * Quem paga o mensal não conta crédito, e os créditos que já tinha
   * ficam guardados — é o que a tela promete, e promessa na tela é
   * contrato.
   */
  describe("plano mensal", () => {
    it("publica sem gastar crédito", async () => {
      await creditarVagas(PESSOA, 3);
      await estenderPlanoMensal(PESSOA);

      expect(await gastarParaPublicar(PESSOA)).toBe(true);

      expect(
        (await direitoDePublicar(PESSOA)).creditos,
        "o mensal não pode comer os créditos comprados antes",
      ).toBe(3);
    });

    it("libera mesmo com zero crédito", async () => {
      await estenderPlanoMensal(PESSOA);

      const direito = await direitoDePublicar(PESSOA);
      expect(direito.pode).toBe(true);
      expect(direito.mensalAtivo).toBe(true);
      expect(direito.creditos).toBe(0);
    });

    it("renovar antes de vencer soma ao prazo que já valia", async () => {
      await estenderPlanoMensal(PESSOA);
      const primeiro = (await direitoDePublicar(PESSOA)).mensalidadeValidaAte;

      await estenderPlanoMensal(PESSOA);
      const segundo = (await direitoDePublicar(PESSOA)).mensalidadeValidaAte;

      expect(new Date(segundo as string).getTime()).toBeGreaterThan(
        new Date(primeiro as string).getTime(),
      );
    });

    it("revogado, volta a depender de crédito", async () => {
      await estenderPlanoMensal(PESSOA);
      await revogarPlanoMensal(PESSOA);

      expect((await direitoDePublicar(PESSOA)).pode).toBe(false);
      expect(await gastarParaPublicar(PESSOA)).toBe(false);
    });
  });

  describe("estorno e chargeback", () => {
    it("tira os créditos que sobraram", async () => {
      await creditarVagas(PESSOA, 5);

      await debitarVagas(PESSOA, 5);

      expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
    });

    /**
     * Para em zero, nunca vira dívida.
     *
     * Quem comprou 5, publicou 4 e depois contestou a cobrança fica sem
     * o crédito que sobrou — e as 4 vagas continuam publicadas. Deixar o
     * saldo negativo cobraria da próxima compra dela uma dívida que
     * ninguém explicou.
     */
    it("não deixa o saldo negativo", async () => {
      await creditarVagas(PESSOA, 5);
      for (let i = 0; i < 4; i += 1) await gastarParaPublicar(PESSOA);

      await debitarVagas(PESSOA, 5);

      expect((await direitoDePublicar(PESSOA)).creditos).toBe(0);
    });
  });

  /**
   * O crédito volta quando a publicação falha depois de cobrada.
   *
   * A cobrança vem antes da gravação de propósito — na ordem inversa a
   * vaga entraria no ar de graça se a carteira falhasse. O preço dessa
   * escolha é este caminho de volta.
   */
  it("devolve o crédito quando a publicação falha depois de cobrada", async () => {
    await creditarVagas(PESSOA, 1);
    await gastarParaPublicar(PESSOA);

    await devolverCredito(PESSOA);

    expect((await direitoDePublicar(PESSOA)).creditos).toBe(1);
  });
});
