/**
 * @vitest-environment node
 *
 * A origem do teto por ação não pode vir de um valor que o cliente forja (#346).
 *
 * O teto por ação (#202) é a única defesa de abuso do app — captcha foi
 * recusado por decisão. A chave, nos fluxos sem sessão, é o IP. Lê-lo do
 * **primeiro** item de `x-forwarded-for` era o buraco: numa cadeia com proxy
 * externo na frente, esse item é o que o cliente mandou, e trocá-lo a cada
 * requisição zera o limite. Este teste prova que a extração ignora essa
 * posição e prefere o header que a borda garante.
 */
import { describe, expect, it, vi } from "vitest";

let cabecalhosFalsos = new Headers();

vi.mock("next/headers", () => ({
  headers: async () => cabecalhosFalsos,
}));

const { origemDaRequisicao } = await import("@/server/origem-da-requisicao");

function com(headers: Record<string, string>): void {
  cabecalhosFalsos = new Headers(headers);
}

describe("origemDaRequisicao", () => {
  it("prefere x-real-ip, que a borda calcula e o cliente não escolhe", async () => {
    com({
      "x-real-ip": "198.51.100.9",
      "x-forwarded-for": "1.1.1.1, 198.51.100.9",
    });
    expect(await origemDaRequisicao()).toBe("198.51.100.9");
  });

  it("NÃO usa o primeiro item de x-forwarded-for, que o cliente forja", async () => {
    // Cliente injeta "6.6.6.6" à esquerda; o proxy confiável acrescenta o
    // IP real à direita. A chave não pode ser o valor injetado.
    com({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" });
    const origem = await origemDaRequisicao();
    expect(origem).not.toBe("6.6.6.6");
    expect(origem).toBe("203.0.113.7");
  });

  it("usa x-vercel-forwarded-for antes do x-forwarded-for comum", async () => {
    com({
      "x-vercel-forwarded-for": "203.0.113.50",
      "x-forwarded-for": "6.6.6.6, 203.0.113.50",
    });
    expect(await origemDaRequisicao()).toBe("203.0.113.50");
  });

  it("cai em 'desconhecida' sem nenhum cabeçalho de origem", async () => {
    com({});
    expect(await origemDaRequisicao()).toBe("desconhecida");
  });
});
