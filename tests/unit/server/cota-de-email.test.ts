/**
 * @vitest-environment node
 *
 * A cota diária de e-mail (#407).
 *
 * O Resend grátis manda 100 por dia, e é uma cota só para o app inteiro. Com
 * limite só de 5 em 15 minutos por origem, um mesmo IP mandava até 480 por
 * dia: esgotava a cota de todo mundo, e enchia a caixa de quem ele quisesse.
 *
 * O que se prova aqui são os dois tetos novos e o cuidado da recuperação:
 * passar do teto da conta não muda a resposta, senão a tela diria quem tem
 * conta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const enviados: { para: string; corpo: string }[] = [];

vi.mock("@/server/email", () => ({
  temEmailConfigurado: true,
  enviarEmail: async (email: { para: string; corpo: string }) => {
    enviados.push(email);
    return { ok: true as const };
  },
}));

import { COTA_DE_EMAIL } from "@/server/auth/cota-de-email";
import { limparLimites } from "@/server/auth/rate-limit";
import { pedirRecuperacao, redefinirSenha } from "@/server/auth/recuperacao";
import {
  confirmarEmail,
  enviarVerificacaoDeEmail,
} from "@/server/auth/verificacao-email";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

const URL_BASE = "https://lupapp.com.br";
const semEspera = async () => {};

/** Os limites de 15 minutos continuam por baixo; o relógio passa por eles. */
const QUINZE_MINUTOS_E_POUCO = 16 * 60 * 1000;

function recuperar(email: string, origem: string) {
  return pedirRecuperacao(email, {
    origem,
    urlBase: URL_BASE,
    dormir: semEspera,
  });
}

function tokenDoUltimo(caminho: string): string {
  const corpo = enviados.at(-1)?.corpo ?? "";
  const achado = new RegExp(`${caminho}\\?token=([\\w-]+)`).exec(corpo);
  if (!achado) throw new Error("nenhum link no e-mail");
  return achado[1];
}

describe("cota diária de e-mail", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let usuarioId: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T08:00:00Z"));
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    enviados.length = 0;
    limparLimites();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const usuario = await repo.criar({
      email: "maria@teste.lupa",
      senhaHash: "hash-antigo",
      papel: "candidato_clt",
      nomeCompleto: "Maria da Silva",
      telefone: "66999990000",
      cidade: "Sinop - MT",
    });
    usuarioId = usuario.id;
  });

  afterEach(() => {
    vi.useRealTimers();
    restaurar();
    vi.restoreAllMocks();
  });

  describe("por conta de destino", () => {
    /*
     * Cada pedido vem de uma origem diferente, para os limites por origem
     * não morderem antes: o que se mede é a caixa da Maria.
     */
    it("a recuperação para de enviar no teto, e a resposta não muda", async () => {
      const { chamadas } = COTA_DE_EMAIL.POR_CONTA;
      for (let i = 0; i < chamadas; i++) {
        expect(await recuperar("maria@teste.lupa", `10.0.0.${i}`)).toEqual({
          ok: true,
        });
      }
      expect(enviados).toHaveLength(chamadas);
      const ultimoLink = tokenDoUltimo("redefinir-senha");

      const alem = await recuperar("maria@teste.lupa", "10.0.1.1");

      expect(alem).toEqual({ ok: true });
      expect(enviados).toHaveLength(chamadas);
      // Nenhum token novo: o último link enviado continua valendo.
      await expect(
        redefinirSenha(ultimoLink, "senhaNova123"),
      ).resolves.toBeDefined();
    });

    it("a resposta além do teto é a mesma de um e-mail sem conta", async () => {
      for (let i = 0; i < COTA_DE_EMAIL.POR_CONTA.chamadas; i++) {
        await recuperar("maria@teste.lupa", `10.0.0.${i}`);
      }

      const comConta = await recuperar("maria@teste.lupa", "10.0.2.1");
      const semConta = await recuperar("ninguem@teste.lupa", "10.0.2.2");

      expect(comConta).toEqual(semConta);
    });

    it("a confirmação diz que passou da cota, e o último link continua valendo", async () => {
      const { chamadas } = COTA_DE_EMAIL.POR_CONTA;
      for (let i = 0; i < chamadas; i++) {
        expect(
          await enviarVerificacaoDeEmail(usuarioId, {
            urlBase: URL_BASE,
            origem: `10.0.3.${i}`,
          }),
        ).toEqual({ ok: true });
      }
      const ultimoLink = tokenDoUltimo("verificar-email");

      const alem = await enviarVerificacaoDeEmail(usuarioId, {
        urlBase: URL_BASE,
        origem: "10.0.4.1",
      });

      expect(alem.ok).toBe(false);
      expect(alem.motivo).toMatch(/muitos e-mails hoje/);
      expect(enviados).toHaveLength(chamadas);
      expect(await confirmarEmail(ultimoLink)).toBe(true);
    });

    it("recuperação e confirmação somam no mesmo teto", async () => {
      await enviarVerificacaoDeEmail(usuarioId, {
        urlBase: URL_BASE,
        origem: "10.0.5.0",
      });
      for (let i = 1; i < COTA_DE_EMAIL.POR_CONTA.chamadas; i++) {
        await recuperar("maria@teste.lupa", `10.0.5.${i}`);
      }
      expect(enviados).toHaveLength(COTA_DE_EMAIL.POR_CONTA.chamadas);

      await recuperar("maria@teste.lupa", "10.0.6.1");
      expect(enviados).toHaveLength(COTA_DE_EMAIL.POR_CONTA.chamadas);
    });

    it("no dia seguinte a conta volta a receber", async () => {
      for (let i = 0; i < COTA_DE_EMAIL.POR_CONTA.chamadas; i++) {
        await recuperar("maria@teste.lupa", `10.0.7.${i}`);
      }
      vi.setSystemTime(new Date("2026-10-10T08:01:00Z"));

      await recuperar("maria@teste.lupa", "10.0.8.1");
      expect(enviados).toHaveLength(COTA_DE_EMAIL.POR_CONTA.chamadas + 1);
    });
  });

  describe("por origem", () => {
    /** Avança o relógio a cada quatro pedidos, abaixo do limite de 15 min. */
    async function gastarCotaDaOrigem(origem: string) {
      for (let i = 0; i < COTA_DE_EMAIL.POR_ORIGEM.chamadas; i++) {
        if (i % 4 === 0) vi.advanceTimersByTime(QUINZE_MINUTOS_E_POUCO);
        await recuperar(`pessoa${i}@teste.lupa`, origem);
      }
      vi.advanceTimersByTime(QUINZE_MINUTOS_E_POUCO);
    }

    /*
     * Os pedidos são para e-mails sem conta, e contam do mesmo jeito.
     * Contando só os que enviam, o bloqueio chegaria mais cedo para quem
     * testa e-mails com conta — e diria quais têm.
     */
    it("conta todo pedido, exista a conta ou não, e recusa no teto", async () => {
      await gastarCotaDaOrigem("198.51.100.7");

      await expect(
        recuperar("maria@teste.lupa", "198.51.100.7"),
      ).rejects.toMatchObject({ codigo: "muitas_tentativas" });
      expect(enviados).toHaveLength(0);
    });

    it("a confirmação de e-mail gasta a mesma cota da origem", async () => {
      await gastarCotaDaOrigem("198.51.100.8");

      await expect(
        enviarVerificacaoDeEmail(usuarioId, {
          urlBase: URL_BASE,
          origem: "198.51.100.8",
        }),
      ).rejects.toMatchObject({ codigo: "muitas_tentativas" });
    });

    it("uma origem no teto não tira a cota das outras", async () => {
      await gastarCotaDaOrigem("198.51.100.9");

      expect(await recuperar("maria@teste.lupa", "198.51.100.10")).toEqual({
        ok: true,
      });
      expect(enviados).toHaveLength(1);
    });
  });
});
