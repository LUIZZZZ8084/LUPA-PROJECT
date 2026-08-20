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

  it("chave nova passa livre", () => {
    expect(() => conferirLimite("login:novo@teste.lupa")).not.toThrow();
  });

  it("bloqueia ao atingir o teto", () => {
    const chave = "login:alvo@teste.lupa";

    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      registrarFalha(chave);
      expect(() => conferirLimite(chave), `tentativa ${i}`).not.toThrow();
    }

    registrarFalha(chave);
    expect(() => conferirLimite(chave)).toThrow();
  });

  it("o erro é 429 e diz quantos segundos faltam", () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++)
      registrarFalha(chave);

    try {
      conferirLimite(chave);
      throw new Error("deveria ter bloqueado");
    } catch (e) {
      if (!ehAppError(e)) throw e;
      expect(e.codigo).toBe("muitas_tentativas");
      expect(e.status).toBe(429);
      expect(e.mensagem).toMatch(/\d+s/);
    }
  });

  it("sucesso zera o contador", () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      registrarFalha(chave);
    }

    registrarSucesso(chave);

    // Depois do sucesso, há espaço para errar tudo de novo.
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      registrarFalha(chave);
    }
    expect(() => conferirLimite(chave)).not.toThrow();
  });

  it("uma chave não afeta a outra", () => {
    const bloqueada = "login:a@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++) {
      registrarFalha(bloqueada);
    }

    expect(() => conferirLimite(bloqueada)).toThrow();
    expect(() => conferirLimite("login:b@teste.lupa")).not.toThrow();
  });

  it("o bloqueio expira sozinho", () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++)
      registrarFalha(chave);
    expect(() => conferirLimite(chave)).toThrow();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + CONFIG_LIMITE.BLOQUEIO_MS + 1000);

    expect(() => conferirLimite(chave)).not.toThrow();
  });

  /**
   * Cinco erros espalhados ao longo de um mês não são ataque — são a pessoa
   * esquecendo a senha. A janela precisa expirar, senão o contador vira uma
   * armadilha para o usuário legítimo.
   */
  it("tentativas fora da janela não se somam", () => {
    const chave = "login:esquecido@teste.lupa";

    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS - 1; i++) {
      registrarFalha(chave);
    }

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + CONFIG_LIMITE.JANELA_MS + 1000);

    // A janela recomeça: mais uma falha não deve bloquear.
    registrarFalha(chave);
    expect(() => conferirLimite(chave)).not.toThrow();
  });

  /**
   * Um atacante variando o e-mail criaria uma chave por tentativa. Sem teto,
   * isso é um vazamento de memória com nome de proteção.
   */
  it("não cresce sem limite com chaves diferentes", () => {
    for (let i = 0; i < 12_000; i++) {
      registrarFalha(`login:${i}@teste.lupa`);
    }

    // Não há como inspecionar o tamanho de fora; o que se garante é que a
    // operação segue respondendo e que uma chave nova continua livre.
    expect(() => conferirLimite("login:novo@teste.lupa")).not.toThrow();
  });

  it("limparLimites zera tudo", () => {
    const chave = "login:alvo@teste.lupa";
    for (let i = 0; i < CONFIG_LIMITE.MAX_TENTATIVAS; i++)
      registrarFalha(chave);
    expect(() => conferirLimite(chave)).toThrow();

    limparLimites();
    expect(() => conferirLimite(chave)).not.toThrow();
  });
});
