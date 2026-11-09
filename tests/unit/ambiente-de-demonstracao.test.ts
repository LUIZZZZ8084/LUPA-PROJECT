/**
 * @vitest-environment node
 *
 * O e2e e o `dev:demo` não falam com provedor de verdade (#584).
 *
 * O que se prova: todo serviço externo do `.env.example` está na lista que
 * os dois zeram, e os dois usam a lista. Provedor novo que não entrar nela
 * reprova aqui, em vez de a suíte local passar a usar a chave real.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  provedoresDesligados,
  VARIAVEIS_DE_PROVEDOR,
} from "../../scripts/ambiente-de-demonstracao.mjs";

/** O que não é credencial de serviço externo, com o porquê. */
const NAO_SAO_PROVEDOR: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "a raiz do próprio app; o e2e define a dele",
  SESSION_SECRET: "segredo local de sessão; o e2e define o dele",
  NEXT_PUBLIC_LUPA_DEMO_WHATSAPP: "número de exibição da demonstração",
  ADMIN_EMAIL: "só lido pelo script de criar admin",
  ADMIN_SENHA: "só lido pelo script de criar admin",
  ADMIN_NOME: "só lido pelo script de criar admin",
  ADMIN_TELEFONE: "só lido pelo script de criar admin",
};

const doExemplo = [
  ...readFileSync(".env.example", "utf8").matchAll(/^([A-Z][A-Z0-9_]*)=/gm),
].map((m) => m[1]);

describe("ambiente de demonstração", () => {
  it("lê as variáveis do .env.example", () => {
    expect(doExemplo.length).toBeGreaterThan(10);
  });

  it.each(doExemplo.filter((n) => !(n in NAO_SAO_PROVEDOR)))(
    "%s é zerada no e2e e no dev:demo",
    (nome) => {
      expect(VARIAVEIS_DE_PROVEDOR).toContain(nome);
      expect(provedoresDesligados()[nome]).toBe("");
    },
  );

  it.each(["playwright.config.ts", "scripts/dev-demo.mjs"])(
    "%s usa a lista",
    (arquivo) => {
      expect(readFileSync(arquivo, "utf8")).toMatch(
        /\.\.\.provedoresDesligados\(\)/,
      );
    },
  );
});
