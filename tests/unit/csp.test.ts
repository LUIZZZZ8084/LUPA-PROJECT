/**
 * A política de segurança, montada por requisição (#223).
 *
 * O e2e confere o que o servidor manda de verdade, e é ele que prova que a
 * tela hidrata. O que sobra para cá é a composição: as regras que dependem
 * do ambiente, e que o e2e roda num ambiente só.
 */
import { describe, expect, it } from "vitest";
import { novoNonce, politicaDeSeguranca } from "@/lib/csp";

function diretiva(politica: string, nome: string): string {
  const achada = politica
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nome} `));
  if (!achada) throw new Error(`sem diretiva ${nome}`);
  return achada;
}

describe("política de segurança", () => {
  it("assina script-src com o nonce recebido", () => {
    const politica = politicaDeSeguranca("abc123", "production");
    expect(diretiva(politica, "script-src")).toContain("'nonce-abc123'");
  });

  /**
   * Navegador que entende nonce ignora `'unsafe-inline'` — o próprio
   * Chrome diz isso na mensagem de recusa. A linha fica como degradação
   * para WebView antiga demais para nonce, que é o aparelho deste
   * público: tirá-la por pureza faria o app não abrir para quem já tem
   * menos opção.
   */
  it("mantém unsafe-inline como degradação, não como permissão", () => {
    const politica = politicaDeSeguranca("abc123", "production");
    const script = diretiva(politica, "script-src");

    expect(script).toContain("'unsafe-inline'");
    // E vem depois do nonce, que é quem manda onde o nonce é entendido.
    expect(script.indexOf("'nonce-")).toBeLessThan(
      script.indexOf("'unsafe-inline'"),
    );
  });

  /**
   * `'unsafe-eval'` existe porque o React em desenvolvimento usa `eval`
   * para reconstruir a pilha de erro vinda do servidor — sem ele, todo
   * `npm run dev` abre com vermelho no console que não tem a ver com o
   * código, e console ruidoso treina a equipe a ignorar console.
   *
   * O e2e não pega isto: ele roda um build de produção, que é justamente
   * o lado onde a permissão não pode existir.
   */
  it("só libera eval em desenvolvimento", () => {
    expect(
      diretiva(politicaDeSeguranca("n", "development"), "script-src"),
    ).toContain("'unsafe-eval'");
    expect(
      diretiva(politicaDeSeguranca("n", "production"), "script-src"),
    ).not.toContain("'unsafe-eval'");
    expect(
      diretiva(politicaDeSeguranca("n", "test"), "script-src"),
    ).not.toContain("'unsafe-eval'");
  });

  /**
   * `connect-src` decide para onde os dados podem sair: é a metade da CSP
   * que impede exfiltração depois de um XSS. Curinga aqui anularia isso.
   */
  it("connect-src não é curinga", () => {
    const connect = diretiva(politicaDeSeguranca("n"), "connect-src");
    expect(connect).toContain("'self'");
    expect(connect).not.toMatch(/connect-src\s+\*/);
  });

  it("fecha o resto do que precisa ficar fechado", () => {
    const politica = politicaDeSeguranca("n", "production");
    for (const esperada of [
      "default-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ]) {
      expect(politica, `faltou ${esperada}`).toContain(esperada);
    }
  });
});

describe("nonce", () => {
  /**
   * Nonce repetido entre requisições anula o ponto: quem o lesse uma vez
   * assinaria script em toda visita seguinte.
   */
  it("é diferente a cada chamada", () => {
    const gerados = new Set(Array.from({ length: 50 }, novoNonce));
    expect(gerados.size).toBe(50);
  });

  /**
   * O nonce entra dentro de um cabeçalho HTTP, entre aspas simples.
   * Caractere que precise de escape ali quebraria a política inteira — e
   * política quebrada é política ausente, sem nada quebrar na tela.
   */
  it("não tem caractere que precise de escape no cabeçalho", () => {
    for (let i = 0; i < 20; i++) {
      expect(novoNonce()).toMatch(/^[a-f0-9]{32}$/);
    }
  });
});
