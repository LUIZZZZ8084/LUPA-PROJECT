/**
 * @vitest-environment node
 *
 * "Esqueci minha senha" (#174).
 *
 * O caminho feliz é o fácil. O que se protege aqui são os três cuidados
 * que fazem esta tela não virar um problema pior do que o que ela
 * resolve:
 *
 * 1. **a resposta é a mesma exista a conta ou não** — a lista de quem tem
 *    conta é a lista de quem procura emprego;
 * 2. **o token não é guardado em claro** — quem lesse a tabela trocaria a
 *    senha de qualquer conta;
 * 3. **o token é de uso único, e o consumo é atômico** — dois cliques no
 *    mesmo link não podem trocar a senha duas vezes.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const enviados: { para: string; assunto: string; corpo: string }[] = [];
const estado = vi.hoisted(() => ({ configurado: true, falha: false }));

vi.mock("@/server/email", () => ({
  get temEmailConfigurado() {
    return estado.configurado;
  },
  enviarEmail: async (email: {
    para: string;
    assunto: string;
    corpo: string;
  }) => {
    if (estado.falha) {
      return { ok: false as const, motivo: "provedor fora do ar" };
    }
    enviados.push(email);
    return { ok: true as const };
  },
}));

import { conferirSenha } from "@/server/auth/password";
import { limparLimites } from "@/server/auth/rate-limit";
import {
  BYTES_DO_TOKEN,
  pedirRecuperacao,
  redefinirSenha,
  VALIDADE_MS,
} from "@/server/auth/recuperacao";
import { ehAppError } from "@/server/errors";
import { RepositorioMemoria, usarRepositorio } from "@/server/repositories";

/**
 * `dormir` no-op: o piso de resposta é de mais de um segundo, e esperá-lo
 * de verdade em cada um dos treze casos deste arquivo trocaria a suíte
 * inteira por uma sala de espera. O que se mede aqui é *que* o piso é
 * respeitado nas duas saídas — abaixo, com o cronômetro em `dormiu` —, e
 * não que `setTimeout` funciona.
 */
const dormiu: number[] = [];
const OPCOES = {
  origem: "1.2.3.4",
  urlBase: "https://lupapp.com.br",
  dormir: async (ms: number) => {
    dormiu.push(ms);
  },
};

/** O link que foi para o e-mail, e o token cru dentro dele. */
function tokenDoUltimoEmail(): string {
  const corpo = enviados.at(-1)?.corpo ?? "";
  const achado = corpo.match(/redefinir-senha\?token=([\w-]+)/);
  if (!achado) throw new Error("nenhum link no e-mail");
  return achado[1];
}

describe("recuperação de senha", () => {
  let repo: RepositorioMemoria;
  let restaurar: () => void;
  let usuarioId: string;

  beforeEach(async () => {
    repo = new RepositorioMemoria();
    restaurar = usarRepositorio(repo);
    enviados.length = 0;
    dormiu.length = 0;
    estado.configurado = true;
    estado.falha = false;
    limparLimites();
    vi.spyOn(console, "log").mockImplementation(() => {});
    /*
     * `error`, e não `warn`: o logger manda os dois níveis por
     * `console.error` para a Vercel separar os fluxos. Silenciar `warn`
     * aqui não calava nada — o ruído continuava saindo, e um teste que
     * quisesse conferir o log estaria olhando para o espião errado.
     */
    vi.spyOn(console, "error").mockImplementation(() => {});

    const usuario = await repo.criar({
      email: "maria@teste.lupa",
      senhaHash: "hash-antigo",
      papel: "candidato_clt",
      nomeCompleto: "Maria da Silva",
      telefone: "66999990000",
      cidade: "Sinop",
    });
    usuarioId = usuario.id;
  });

  afterEach(() => {
    vi.useRealTimers();
    restaurar();
    vi.restoreAllMocks();
  });

  describe("pedir o link", () => {
    it("manda o e-mail para quem tem conta", async () => {
      const r = await pedirRecuperacao("maria@teste.lupa", OPCOES);

      expect(r.ok).toBe(true);
      expect(enviados).toHaveLength(1);
      expect(enviados[0].para).toBe("maria@teste.lupa");
      expect(enviados[0].corpo).toContain(
        "https://lupapp.com.br/redefinir-senha?token=",
      );
    });

    /**
     * O cuidado que decide se esta tela é segura.
     *
     * Uma resposta diferente para e-mail que não existe transformaria a
     * tela num confirmador de contas — e aqui ter conta significa estar
     * procurando emprego, o que pode custar o emprego atual de alguém. É
     * a mesma razão pela qual o login não diz se o e-mail existe.
     */
    it("responde igual para e-mail que não existe, e não manda nada", async () => {
      const r = await pedirRecuperacao("ninguem@teste.lupa", OPCOES);

      expect(r.ok, "a resposta precisa ser indistinguível").toBe(true);
      expect(enviados).toHaveLength(0);
    });

    it("normaliza o e-mail — maiúscula e espaço não escondem a conta", async () => {
      await pedirRecuperacao("  MARIA@Teste.Lupa  ", OPCOES);
      expect(enviados).toHaveLength(1);
    });

    /**
     * Sem provedor configurado o recurso não existe, e a tela diz isso —
     * mesma degradação do Storage sem Supabase. Fingir que enviou deixaria
     * a pessoa esperando um e-mail que nunca sai.
     */
    it("sem provedor de e-mail, recusa e explica", async () => {
      estado.configurado = false;

      const r = await pedirRecuperacao("maria@teste.lupa", OPCOES);

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.motivo).toMatch(/não está disponível|suporte/i);
    });

    /**
     * Falha de envio responde `ok`, e a inversão é deliberada.
     *
     * Este teste exigia o contrário até 09/09/2026 — e o contrário era um
     * oráculo de contas melhor que o de tempo, porque não precisava de
     * cronômetro: "não conseguimos enviar" só aparecia para quem **tem**
     * conta, já que quem não tem nunca chega à linha do envio. Bastava
     * ler a mensagem para saber quem está cadastrado, que é exatamente o
     * que a frase idêntica das duas saídas existe para impedir.
     *
     * O que substitui a garantia antiga é o log: o `warn` continua saindo,
     * com o motivo, e é lá que quem opera vai olhar. Silencioso para a
     * pessoa, não para nós.
     */
    it("falha do provedor não vaza que a conta existe", async () => {
      estado.falha = true;
      // `warn` e `error` saem por `console.error`, para a Vercel separar
      // os fluxos — ver `emitir` em `src/server/logger.ts`.
      const avisos = vi.mocked(console.error);
      avisos.mockClear();

      const r = await pedirRecuperacao("maria@teste.lupa", OPCOES);

      expect(r.ok, "a resposta precisa ser indistinguível").toBe(true);
      expect(enviados, "e nada foi enviado de verdade").toHaveLength(0);
      expect(avisos, "mas o motivo fica no log").toHaveBeenCalled();
    });

    /**
     * O piso de tempo, que é a outra metade do disfarce.
     *
     * Responder a mesma frase não basta se uma das saídas demora o dobro:
     * conta que existe grava token e chama o provedor pela rede, conta que
     * não existe volta de uma leitura só. Sem o piso, cronometrar a tela
     * responde o que ela se recusa a dizer.
     */
    it("as duas saídas esperam o mesmo piso de tempo", async () => {
      await pedirRecuperacao("maria@teste.lupa", OPCOES);
      const comConta = dormiu.length;

      dormiu.length = 0;
      limparLimites();
      await pedirRecuperacao("ninguem@teste.lupa", OPCOES);

      expect(comConta, "quem tem conta espera o piso").toBe(1);
      expect(dormiu, "quem não tem espera o mesmo piso").toHaveLength(1);
    });

    /**
     * O limite é por origem e conta **toda** tentativa, como no cadastro:
     * sem ele, esta tela vira um canal para mandar e-mail em nome da Lupa
     * a qualquer endereço, e quem paga a reputação do domínio somos nós.
     */
    it("limita por origem, mesmo com e-mails diferentes", async () => {
      for (let i = 0; i < 5; i += 1) {
        await pedirRecuperacao(`pessoa${i}@teste.lupa`, OPCOES);
      }

      await expect(
        pedirRecuperacao("outra@teste.lupa", OPCOES),
      ).rejects.toMatchObject({ codigo: "muitas_tentativas" });
    });

    it("origem diferente não herda o limite da outra", async () => {
      for (let i = 0; i < 5; i += 1) {
        await pedirRecuperacao(`pessoa${i}@teste.lupa`, OPCOES);
      }

      const r = await pedirRecuperacao("maria@teste.lupa", {
        ...OPCOES,
        origem: "9.9.9.9",
      });
      expect(r.ok).toBe(true);
    });
  });

  describe("o token", () => {
    /**
     * O que existe no banco não pode servir para trocar senha nenhuma.
     *
     * Guardar em claro faria de um backup exposto — ou de um acesso de
     * leitura mal concedido — a chave de qualquer conta do app.
     */
    it("é guardado em hash, nunca em claro", async () => {
      await pedirRecuperacao("maria@teste.lupa", OPCOES);
      const token = tokenDoUltimoEmail();

      // O que a aplicação gravou é o SHA-256 — o cru não abre nada.
      expect(await repo.consumirTokenDeRecuperacao(token)).toBeNull();

      const hash = createHash("sha256").update(token).digest("hex");
      expect(await repo.consumirTokenDeRecuperacao(hash)).toMatchObject({
        usuarioId,
      });
    });

    it("tem entropia de sobra — 32 bytes aleatórios", async () => {
      expect(BYTES_DO_TOKEN).toBe(32);

      await pedirRecuperacao("maria@teste.lupa", OPCOES);
      const primeiro = tokenDoUltimoEmail();
      await pedirRecuperacao("maria@teste.lupa", OPCOES);

      expect(tokenDoUltimoEmail()).not.toBe(primeiro);
    });

    it("vale por uma hora", () => {
      expect(VALIDADE_MS).toBe(60 * 60 * 1000);
    });
  });

  describe("redefinir", () => {
    async function pedirEPegarToken() {
      await pedirRecuperacao("maria@teste.lupa", OPCOES);
      return tokenDoUltimoEmail();
    }

    it("troca a senha e devolve quem entrou", async () => {
      const token = await pedirEPegarToken();

      const sessao = await redefinirSenha(token, "senhaNova123");

      expect(sessao).toEqual({ usuarioId, papel: "candidato_clt" });

      const usuario = await repo.porId(usuarioId);
      expect(
        await conferirSenha("senhaNova123", usuario?.senhaHash ?? ""),
        "a senha nova precisa valer de verdade",
      ).toBe(true);
    });

    /**
     * Uso único, e o consumo é atômico.
     *
     * Dois cliques no mesmo link — ou um link vazado sendo usado em
     * paralelo — passariam os dois por uma leitura anterior. A segunda
     * tentativa precisa falhar, senão o link vira uma chave permanente.
     */
    it("o mesmo token não serve duas vezes", async () => {
      const token = await pedirEPegarToken();
      await redefinirSenha(token, "senhaNova123");

      await expect(
        redefinirSenha(token, "outraSenha456"),
      ).rejects.toMatchObject({ codigo: "validacao" });
    });

    it("token expirado não vale", async () => {
      const token = await pedirEPegarToken();

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + VALIDADE_MS + 1000);

      await expect(redefinirSenha(token, "senhaNova123")).rejects.toMatchObject(
        { codigo: "validacao" },
      );
    });

    it("token inventado não vale, e a mensagem não confirma nada", async () => {
      try {
        await redefinirSenha("token-que-nunca-existiu", "senhaNova123");
        throw new Error("esperava erro");
      } catch (e) {
        if (!ehAppError(e)) throw e;
        expect(e.codigo).toBe("validacao");
        expect(e.mensagem).toMatch(/não vale mais|inválido/i);
      }
    });

    /** A senha antiga precisa parar de funcionar — senão não trocou nada. */
    it("a senha antiga deixa de valer", async () => {
      const token = await pedirEPegarToken();
      await redefinirSenha(token, "senhaNova123");

      const usuario = await repo.porId(usuarioId);
      expect(usuario?.senhaHash).not.toBe("hash-antigo");
    });
  });
});
