import { readFileSync } from "node:fs";
/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONFIG_LIMITE,
  conferirLimite,
  limparLimites,
  registrarFalha,
  registrarSucesso,
} from "@/server/auth/rate-limit";
import { ehAppError } from "@/server/errors";

describe("limite de tentativas", () => {
  beforeEach(() => {
    limparLimites();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chave nova passa livre", async () => {
    await expect(
      conferirLimite("login:novo@teste.lupa"),
    ).resolves.toBeUndefined();
  });

  it("bloqueia ao atingir o teto", async () => {
    const chave = "login:alvo@teste.lupa";

    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      await registrarFalha(chave);
      await expect(
        conferirLimite(chave),
        `tentativa ${i}`,
      ).resolves.toBeUndefined();
    }

    await registrarFalha(chave);
    await expect(conferirLimite(chave)).rejects.toThrow();
  });

  it("o erro é 429 e diz quantos segundos faltam", async () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++)
      await registrarFalha(chave);

    try {
      await conferirLimite(chave);
      throw new Error("deveria ter bloqueado");
    } catch (e) {
      if (!ehAppError(e)) throw e;
      expect(e.codigo).toBe("muitas_tentativas");
      expect(e.status).toBe(429);
      expect(e.mensagem).toMatch(/\d+s/);
    }
  });

  it("sucesso zera o contador", async () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      await registrarFalha(chave);
    }

    await registrarSucesso(chave);

    // Depois do sucesso, há espaço para errar tudo de novo.
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      await registrarFalha(chave);
    }
    await expect(conferirLimite(chave)).resolves.toBeUndefined();
  });

  it("uma chave não afeta a outra", async () => {
    const bloqueada = "login:a@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
      await registrarFalha(bloqueada);
    }

    await expect(conferirLimite(bloqueada)).rejects.toThrow();
    await expect(conferirLimite("login:b@teste.lupa")).resolves.toBeUndefined();
  });

  it("o bloqueio expira sozinho", async () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++)
      await registrarFalha(chave);
    await expect(conferirLimite(chave)).rejects.toThrow();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + CONFIG_LIMITE.BLOQUEIO_MS + 1000);

    await expect(conferirLimite(chave)).resolves.toBeUndefined();
  });

  /**
   * Cinco erros espalhados ao longo de um mês não são ataque — são a pessoa
   * esquecendo a senha. A janela precisa expirar, senão o contador vira uma
   * armadilha para o usuário legítimo.
   */
  it("tentativas fora da janela não se somam", async () => {
    const chave = "login:esquecido@teste.lupa";

    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      await registrarFalha(chave);
    }

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + CONFIG_LIMITE.JANELA_MS + 1000);

    // A janela recomeça: mais uma falha não deve bloquear.
    await registrarFalha(chave);
    await expect(conferirLimite(chave)).resolves.toBeUndefined();
  });

  /**
   * Um atacante variando o e-mail criaria uma chave por tentativa. Sem teto,
   * isso é um vazamento de memória com nome de proteção.
   */
  it("não cresce sem limite com chaves diferentes", async () => {
    for (let i = 0; i < 12_000; i++) {
      await registrarFalha(`login:${i}@teste.lupa`);
    }

    // Não há como inspecionar o tamanho de fora; o que se garante é que a
    // operação segue respondendo e que uma chave nova continua livre.
    await expect(
      conferirLimite("login:novo@teste.lupa"),
    ).resolves.toBeUndefined();
  });

  it("limparLimites zera tudo", async () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++)
      await registrarFalha(chave);
    await expect(conferirLimite(chave)).rejects.toThrow();

    limparLimites();
    await expect(conferirLimite(chave)).resolves.toBeUndefined();
  });
});

/**
 * O limite chega inteiro em quem chama.
 *
 * Quando `conferirLimite` virou assíncrona, as seis chamadas em
 * `auth/servico.ts` continuaram sem `await` — e o TypeScript não reclama
 * de promessa ignorada. O efeito seria o pior possível: o limite parece
 * existir, o teste desta unidade passa, e o bloqueio nunca acontece no
 * login de verdade.
 *
 * Este teste varre o código-fonte, como o contrato de cidade em
 * `cidades.test.ts` — a chamada errada é sintática, e uma varredura pega
 * o que um teste de comportamento sobre a unidade não pega.
 */
describe("contrato de quem usa o limite", () => {
  const fonte = readFileSync("src/server/auth/servico.ts", "utf8");
  const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

  it.each(["conferirLimite", "registrarFalha", "registrarSucesso"])(
    "%s é sempre chamada com await",
    (funcao) => {
      const chamadas = [
        ...semComentarios.matchAll(
          new RegExp(String.raw`(\w+\s+)?${funcao}\(`, "g"),
        ),
      ];

      expect(chamadas.length, `nenhuma chamada de ${funcao}`).toBeGreaterThan(
        0,
      );

      for (const chamada of chamadas) {
        // `import { conferirLimite }` casa sem prefixo; a linha do import é
        // a única exceção legítima.
        const linha = semComentarios.slice(0, chamada.index).split("\n").at(-1);
        if (linha?.includes("import")) continue;

        expect(chamada[1]?.trim(), `sem await: ${chamada[0]}`).toBe("await");
      }
    },
  );
});
