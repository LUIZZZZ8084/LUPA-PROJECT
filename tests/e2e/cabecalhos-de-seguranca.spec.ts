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
   * O nonce é o que faz `script-src` valer alguma coisa (#223).
   *
   * Até a #223 a política trazia `'unsafe-inline'` sozinho, e com isso não
   * impedia justamente a coisa que ela existe para impedir: script
   * injetado rodava, e `<img onerror=...>` também. O que restava era
   * `'self'` barrando script de terceiro por `src`.
   *
   * Navegador que entende nonce ignora `'unsafe-inline'` quando há nonce
   * na política — por isso os dois convivem, e o antigo continua ali como
   * degradação para WebView velha, que é o aparelho deste público.
   */
  test("script-src traz nonce, e ele muda a cada requisição", async ({
    request,
  }) => {
    const nonceDe = async () => {
      const csp =
        (await request.get("/entrar")).headers()["content-security-policy"] ??
        "";
      return /'nonce-([A-Za-z0-9+/=_-]+)'/.exec(csp)?.[1];
    };

    const primeiro = await nonceDe();
    const segundo = await nonceDe();

    expect(primeiro, "script-src sem nonce").toBeTruthy();
    expect(primeiro?.length ?? 0).toBeGreaterThanOrEqual(16);

    /*
     * Nonce reaproveitado entre requisições anula o ponto: quem o lesse
     * uma vez assinaria script em toda visita seguinte. E é o erro fácil
     * de cometer — basta gerar a política fora do handler.
     */
    expect(segundo, "o nonce se repetiu entre requisições").not.toBe(primeiro);
  });

  /**
   * A prova de que o nonce não é só enfeite no cabeçalho: a página precisa
   * hidratar sem o navegador recusar nada.
   *
   * O AGENTS.md registra três vezes o mesmo erro — declarar que algo
   * funciona sem abrir um navegador de verdade. Um nonce que o Next não
   * aplique aos próprios scripts deixa a CSP perfeita no cabeçalho e o app
   * morto na tela, e nenhum teste de requisição pegaria isso.
   */
  test("a tela hidrata sem violação de CSP no console", async ({ page }) => {
    const violacoes: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy|Refused to (execute|load)/i.test(msg.text()))
        violacoes.push(msg.text());
    });

    await page.goto("/entrar");
    // O botão só responde depois da hidratação.
    await expect(page.getByRole("button", { name: /Entrar/i })).toBeEnabled();

    expect(violacoes, violacoes.join(" | ")).toEqual([]);
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
