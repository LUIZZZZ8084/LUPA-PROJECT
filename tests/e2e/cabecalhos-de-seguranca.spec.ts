import { expect, test } from "@playwright/test";

/**
 * Cabeçalho de segurança some sem quebrar nada.
 *
 * Nenhuma tela fica diferente, nenhum teste de fluxo falha, e a proteção
 * simplesmente deixa de existir — até alguém abusar. Por isso a verificação
 * é aqui, contra a resposta HTTP de verdade, e não lendo o `next.config`:
 * o que protege é o que o servidor manda, não o que o arquivo declara.
 */
test.describe("cabeçalhos de segurança", () => {
  test("a resposta traz os cabeçalhos esperados", async ({ request }) => {
    const resposta = await request.get("/entrar");
    const h = resposta.headers();

    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  /**
   * A CSP é a última linha: se alguma entrada escapar do escape em qualquer
   * lugar, é ela que impede o script injetado de rodar ou de mandar o que
   * roubou para fora.
   */
  test("a CSP existe e fecha o que precisa fechar", async ({ request }) => {
    const csp = (await request.get("/entrar")).headers()[
      "content-security-policy"
    ];

    expect(csp, "sem CSP nenhuma").toBeTruthy();

    // `object-src 'none'` mata plugin legado; `frame-ancestors 'none'`
    // repete o X-Frame-Options para navegador que ignora o cabeçalho antigo.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  /**
   * `connect-src` decide para onde os dados podem sair. Curinga aqui
   * anularia a parte da CSP que impede exfiltração.
   */
  test("connect-src não é curinga", async ({ request }) => {
    const csp =
      (await request.get("/entrar")).headers()["content-security-policy"] ?? "";

    const connect = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src"));

    expect(connect).toBeTruthy();
    expect(connect).not.toContain("*;");
    expect(connect).not.toBe("connect-src *");
    expect(connect).toContain("'self'");
  });

  /**
   * `X-Powered-By` entrega o framework a quem procura alvo, sem nenhum
   * ganho para quem usa o site.
   */
  test("não anuncia o framework", async ({ request }) => {
    const h = (await request.get("/entrar")).headers();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  /**
   * Os cabeçalhos valem para o app inteiro, não só para a página de
   * entrada — é fácil configurar uma rota e esquecer o resto.
   */
  test("valem em todas as rotas, inclusive nas que redirecionam", async ({
    request,
  }) => {
    for (const rota of ["/", "/vagas", "/cadastro"]) {
      const h = (await request.get(rota, { maxRedirects: 0 })).headers();
      expect(h["content-security-policy"], `${rota} sem CSP`).toBeTruthy();
      expect(h["x-content-type-options"], `${rota} sem nosniff`).toBe(
        "nosniff",
      );
    }
  });
});
