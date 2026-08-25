/**
 * @vitest-environment node
 *
 * A configuração de observabilidade, e não só o embaralhador de dados.
 *
 * Estas constantes são lidas uma vez, no carregamento do módulo, e depois
 * viajam para dentro do Sentry. Teste que só confere "está entre 0 e 1"
 * deixa passar uma amostragem trocada de 10% para 100% — que estoura a cota
 * gratuita no primeiro pico e faz o monitoramento parar de reportar
 * justamente no dia em que alguma coisa quebrou.
 *
 * Cada caso recarrega o módulo com o ambiente que quer medir; sem isso, o
 * valor congelado na primeira importação valeria para todos.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const VARIAVEIS = [
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_APP_ENV",
  "VERCEL_ENV",
  "NODE_ENV",
  "NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
] as const;

async function carregarCom(ambiente: Partial<Record<string, string>>) {
  vi.resetModules();
  for (const nome of VARIAVEIS) vi.stubEnv(nome, undefined as never);
  for (const [nome, valor] of Object.entries(ambiente)) {
    vi.stubEnv(nome, valor as string);
  }
  return import("@/lib/observability");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("envio ao Sentry", () => {
  it("sem DSN, nada é enviado — é o que mantém a demonstração leve", async () => {
    const mod = await carregarCom({});
    expect(mod.SENTRY_DSN).toBe("");
    expect(mod.isSentryEnabled).toBe(false);
  });

  it("com DSN, o envio liga", async () => {
    const mod = await carregarCom({
      NEXT_PUBLIC_SENTRY_DSN: "https://exemplo@sentry.io/1",
    });
    expect(mod.SENTRY_DSN).toBe("https://exemplo@sentry.io/1");
    expect(mod.isSentryEnabled).toBe(true);
  });
});

describe("qual ambiente o erro diz que é", () => {
  /*
   * A ordem da cadeia não é arbitrária: `NEXT_PUBLIC_APP_ENV` é o que a
   * gente define à mão para separar prévia de produção dentro da mesma
   * conta da Vercel. Se `VERCEL_ENV` ganhasse, todo deploy de prévia
   * chegaria ao Sentry marcado como produção e o alerta perderia o
   * significado.
   */
  it("APP_ENV ganha de VERCEL_ENV e de NODE_ENV", async () => {
    const mod = await carregarCom({
      NEXT_PUBLIC_APP_ENV: "homologacao",
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
    });
    expect(mod.ENVIRONMENT).toBe("homologacao");
  });

  it("sem APP_ENV, vale o da Vercel", async () => {
    const mod = await carregarCom({ VERCEL_ENV: "preview", NODE_ENV: "test" });
    expect(mod.ENVIRONMENT).toBe("preview");
  });

  it("sem nenhum dos dois, vale o do Node", async () => {
    const mod = await carregarCom({ NODE_ENV: "test" });
    expect(mod.ENVIRONMENT).toBe("test");
  });

  it("sem nada, assume desenvolvimento", async () => {
    const mod = await carregarCom({});
    expect(mod.ENVIRONMENT).toBe("development");
  });
});

describe("qual commit gerou o build", () => {
  it("prefere o sha exposto ao cliente", async () => {
    const mod = await carregarCom({
      NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: "abc123",
      VERCEL_GIT_COMMIT_SHA: "def456",
    });
    expect(mod.RELEASE).toBe("abc123");
  });

  it("cai no sha do servidor quando o outro não existe", async () => {
    const mod = await carregarCom({ VERCEL_GIT_COMMIT_SHA: "def456" });
    expect(mod.RELEASE).toBe("def456");
  });

  it("fora da Vercel, fica sem release — e não vira string vazia", async () => {
    const mod = await carregarCom({});
    expect(mod.RELEASE).toBeUndefined();
  });
});

describe("amostragem de rastros", () => {
  it("em produção é 10%, o que cabe na cota gratuita", async () => {
    const mod = await carregarCom({ NEXT_PUBLIC_APP_ENV: "production" });
    expect(mod.TRACES_SAMPLE_RATE).toBe(0.1);
  });

  it("fora de produção é tudo, porque o volume é pequeno", async () => {
    for (const ambiente of ["development", "preview", "test"]) {
      const mod = await carregarCom({ NEXT_PUBLIC_APP_ENV: ambiente });
      expect(mod.TRACES_SAMPLE_RATE, ambiente).toBe(1);
    }
  });
});

describe("erros silenciados", () => {
  /*
   * A lista inteira, item a item. Conferir só "contém ResizeObserver"
   * deixava trocar qualquer um dos outros sem nenhum teste reclamar — e
   * um item alterado significa ou alerta que volta a tocar à toa, ou erro
   * de verdade sumindo do painel.
   */
  it("é exatamente esta lista", async () => {
    const { IGNORED_ERRORS } = await carregarCom({});

    expect(IGNORED_ERRORS).toEqual([
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "Failed to fetch",
      "NetworkError when attempting to fetch resource",
      "AbortError",
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
    ]);
  });

  it("as expressões pegam o esquema no começo, não no meio", async () => {
    const { IGNORED_ERRORS } = await carregarCom({});
    const regex = IGNORED_ERRORS.filter((i) => i instanceof RegExp);

    expect(regex).toHaveLength(2);
    expect(regex.some((r) => r.test("chrome-extension://abc/script.js"))).toBe(
      true,
    );
    expect(regex.some((r) => r.test("moz-extension://abc/script.js"))).toBe(
      true,
    );

    // Uma URL nossa que apenas mencione a palavra não pode ser silenciada.
    expect(
      regex.some((r) => r.test("https://lupa.app/chrome-extension://x")),
    ).toBe(false);
  });
});
