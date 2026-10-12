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

const { agruparOrigem, origemDaRequisicao } = await import(
  "@/server/origem-da-requisicao"
);

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

  it("IPv6 da borda vira a rede /64", async () => {
    com({ "x-real-ip": "2804:14c:5b80:8a1c:1d2e:3f40:5a6b:7c8d" });
    expect(await origemDaRequisicao()).toBe("2804:14c:5b80:8a1c::/64");
  });
});

/**
 * O IPv6 agrupado pela rede (#415).
 *
 * Quem tem IPv6 recebe uma /64 inteira e escolhe o endereço. Pelo endereço,
 * cada troca era um teto novo.
 */
describe("agruparOrigem", () => {
  it("dois endereços da mesma /64 são a mesma origem", () => {
    const a = agruparOrigem("2804:14c:5b80:8a1c:1d2e:3f40:5a6b:7c8d");
    const b = agruparOrigem("2804:14c:5b80:8a1c::1");
    expect(a).toBe(b);
  });

  it("redes diferentes continuam origens diferentes", () => {
    expect(agruparOrigem("2804:14c:5b80:8a1c::1")).not.toBe(
      agruparOrigem("2804:14c:5b80:8a1d::1"),
    );
  });

  it("escritas diferentes do mesmo prefixo dão a mesma chave", () => {
    expect(agruparOrigem("2804:014C:5B80:0000:0:0:0:9")).toBe(
      agruparOrigem("2804:14c:5b80::9"),
    );
  });

  it("IPv4 passa como veio", () => {
    expect(agruparOrigem("203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv4 mapeado em IPv6 volta a ser o IPv4", () => {
    expect(agruparOrigem("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("IPv6 com IPv4 no fim conta os grupos certos", () => {
    expect(agruparOrigem("2804:14c:5b80:8a1c::203.0.113.7")).toBe(
      "2804:14c:5b80:8a1c::/64",
    );
  });

  it("identificador de zona não muda a chave", () => {
    expect(agruparOrigem("fe80::1%eth0")).toBe(agruparOrigem("fe80::2"));
  });

  /** Uma chave estranha limita uma pessoa; um erro aqui, o cadastro inteiro. */
  it("o que não se reconhece passa sem lançar", () => {
    for (const lixo of ["", "desconhecida", "1::2::3", "zzzz::1", ":::"]) {
      expect(() => agruparOrigem(lixo)).not.toThrow();
    }
    expect(agruparOrigem("desconhecida")).toBe("desconhecida");
  });
});
