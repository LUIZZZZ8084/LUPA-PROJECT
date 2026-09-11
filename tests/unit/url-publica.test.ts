/**
 * A URL pública do app não se adivinha em produção (#195).
 *
 * O teste existe por um prejuízo concreto: em 10/09/2026 a primeira venda
 * de verdade da Lupa — R$ 29,90, aprovada no Mercado Pago — nunca chegou
 * ao app. Sem `NEXT_PUBLIC_APP_URL`, o `notification_url` saía com
 * `VERCEL_URL`, que é a URL gerada do deploy e muda a cada publicação. O
 * dinheiro entrou, a cobrança ficou `pendente` para sempre, e ninguém
 * ficou sabendo até alguém conferir à mão.
 *
 * O que se trava aqui é o **modo de falha**: em produção, faltar a
 * variável tem que estourar. Nenhuma asserção sobre o valor certo
 * protegeria contra isso — o valor errado era sintaticamente válido.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { urlPublica } from "@/server/url-publica";

const CHAVES = ["NEXT_PUBLIC_APP_URL", "VERCEL_ENV", "VERCEL_URL"] as const;

let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(CHAVES.map((k) => [k, process.env[k]]));
  for (const k of CHAVES) delete process.env[k];
});

afterEach(() => {
  for (const k of CHAVES) {
    const valor = original[k];
    if (valor === undefined) delete process.env[k];
    else process.env[k] = valor;
  }
});

describe("urlPublica", () => {
  it("usa o que está configurado, quando está", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://lupapp.com.br";
    expect(urlPublica()).toBe("https://lupapp.com.br");
  });

  /**
   * Barra no fim é erro provável e caro: viraria `...br//api/webhooks`,
   * um deploy inteiro perdido por um caractere.
   */
  it("tolera a barra no fim", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://lupapp.com.br/";
    expect(urlPublica()).toBe("https://lupapp.com.br");
  });

  /**
   * O caso que motivou tudo. Antes daqui, isto devolvia
   * `https://lupa-project-<hash>.vercel.app` sem dizer nada a ninguém.
   */
  it("em produção, recusa em vez de deduzir", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "lupa-project-abc123.vercel.app";

    expect(() => urlPublica()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  /**
   * Preview continua deduzindo, e está certo: ali a URL do deploy é
   * mesmo o endereço onde a pessoa está. Exigir configuração por branch
   * tiraria o único ambiente onde dá para exercitar cobrança sem tocar no
   * domínio real.
   */
  it("em preview, deduz da URL do deploy", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "lupa-project-abc123.vercel.app";

    expect(urlPublica()).toBe("https://lupa-project-abc123.vercel.app");
  });

  it("fora da Vercel, é a máquina de quem está desenvolvendo", () => {
    expect(urlPublica()).toBe("http://localhost:3000");
  });

  /**
   * A variável configurada vence até em produção com `VERCEL_URL`
   * presente — que é o arranjo real do app hoje. Sem esta asserção, uma
   * inversão na ordem das condições passaria: as duas devolvem string.
   */
  it("o que está configurado vence a URL do deploy", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://lupapp.com.br";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_URL = "lupa-project-abc123.vercel.app";

    expect(urlPublica()).toBe("https://lupapp.com.br");
  });
});
