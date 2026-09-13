/**
 * @vitest-environment node
 *
 * O teto de volume das server actions (#202).
 *
 * O que se protege aqui não é o caminho feliz — é o que a recusa faz e o
 * que ela **não** faz. Um teto que recusa depois de executar não é teto, é
 * mensagem; e um teto que confunde duas pessoas numa chave só transforma
 * proteção em dano, que é exatamente o motivo de a chave ser a sessão e
 * não o IP.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

let sessaoFalsa: { usuarioId: string; papel: string } | null = null;

vi.mock("@/server/auth/cookies", () => ({
  sessaoAtual: async () => sessaoFalsa,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

const { criarAcao } = await import("@/server/action");
const { consumirOrcamento, limparLimites } = await import(
  "@/server/auth/rate-limit"
);
const { ORCAMENTOS, SEM_ORCAMENTO } = await import("@/server/limites");

const { z } = await import("zod");

describe("teto de volume", () => {
  beforeEach(() => {
    limparLimites();
    sessaoFalsa = { usuarioId: "pessoa-1", papel: "candidato_clt" };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    limparLimites();
    vi.restoreAllMocks();
  });

  const orcamento = { chamadas: 3, janelaSegundos: 600 };

  it("deixa passar enquanto cabe, e recusa a que não cabe", async () => {
    for (let i = 0; i < orcamento.chamadas; i += 1) {
      await consumirOrcamento("k", orcamento);
    }

    await expect(consumirOrcamento("k", orcamento)).rejects.toMatchObject({
      codigo: "muitas_tentativas",
    });
  });

  /**
   * A razão de a chave ser a sessão.
   *
   * Em Sinop, lan house, escritório e provedor de rádio põem dezenas de
   * pessoas atrás do mesmo IP. Se duas pessoas dividissem contador, uma
   * derrubaria a outra — e o público deste app é justamente quem usa
   * conexão compartilhada.
   */
  it("uma pessoa não gasta o orçamento da outra", async () => {
    for (let i = 0; i < orcamento.chamadas; i += 1) {
      await consumirOrcamento("pessoa-a", orcamento);
    }
    await expect(
      consumirOrcamento("pessoa-a", orcamento),
    ).rejects.toMatchObject({ codigo: "muitas_tentativas" });

    await expect(
      consumirOrcamento("pessoa-b", orcamento),
    ).resolves.toBeUndefined();
  });

  it("a recusa diz quantos segundos faltam", async () => {
    await consumirOrcamento("k", { chamadas: 1, janelaSegundos: 600 });

    await expect(
      consumirOrcamento("k", { chamadas: 1, janelaSegundos: 600 }),
    ).rejects.toMatchObject({
      mensagem: expect.stringContaining("Espere"),
    });
  });

  describe("dentro de criarAcao", () => {
    /**
     * O caso que decide se o teto serve para alguma coisa.
     *
     * Recusar **depois** de executar seria pior que não ter teto: a ação
     * aconteceria e a pessoa leria que não aconteceu.
     */
    it("a ação recusada não chega a executar", async () => {
      const executar = vi.fn(async () => "feito");
      const acao = criarAcao({
        nome: "candidatura.criar",
        entrada: z.object({}),
        executar,
      });

      const teto = ORCAMENTOS["candidatura.criar"].chamadas;
      for (let i = 0; i < teto; i += 1) await acao({});

      expect(executar).toHaveBeenCalledTimes(teto);

      const recusada = await acao({});
      expect(recusada).toMatchObject({
        ok: false,
        codigo: "muitas_tentativas",
      });
      expect(executar).toHaveBeenCalledTimes(teto);
    });

    /** Estourar o teto de publicar vaga não pode barrar candidatar-se. */
    it("cada ação tem o próprio contador", async () => {
      const publicar = criarAcao({
        nome: "vaga.publicar",
        entrada: z.object({}),
        executar: async () => "publicada",
      });
      const candidatar = criarAcao({
        nome: "candidatura.criar",
        entrada: z.object({}),
        executar: async () => "enviada",
      });

      for (let i = 0; i < ORCAMENTOS["vaga.publicar"].chamadas + 2; i += 1) {
        await publicar({});
      }

      await expect(candidatar({})).resolves.toMatchObject({ ok: true });
    });

    /**
     * Sem sessão o contador cai no IP — é o que sobra, e é o certo: antes
     * da conta existir não há pessoa para contar contra.
     */
    it("sem sessão, conta contra a origem", async () => {
      sessaoFalsa = null;
      const acao = criarAcao({
        nome: "notificacao.inscrever",
        entrada: z.object({}),
        executar: async () => "ok",
      });

      const teto = ORCAMENTOS["notificacao.inscrever"].chamadas;
      for (let i = 0; i < teto; i += 1) await acao({});

      await expect(acao({})).resolves.toMatchObject({
        codigo: "muitas_tentativas",
      });
    });

    /**
     * As de autenticação têm limite próprio, com regra diferente — e
     * somar um segundo teto por cima mudaria o comportamento delas sem
     * ninguém ter decidido isso.
     */
    it("ação dispensada passa direto", async () => {
      expect("auth.entrar" in SEM_ORCAMENTO).toBe(true);

      const acao = criarAcao({
        nome: "auth.entrar",
        entrada: z.object({}),
        executar: async () => "ok",
      });

      for (let i = 0; i < 40; i += 1) {
        expect(await acao({})).toMatchObject({ ok: true });
      }
    });
  });
});
