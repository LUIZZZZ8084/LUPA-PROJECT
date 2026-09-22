import { expect, test } from "@playwright/test";

/**
 * O muro de login, e o que fica de fora dele.
 *
 * O app é fechado por decisão de produto: sem conta não se navega — exceto
 * a home, pública desde a #241. Mas o muro roda na borda, antes de a
 * página existir, e o que ele cobre é decidido por uma expressão regular
 * no `matcher` de `src/proxy.ts` — o tipo de lugar onde um item esquecido
 * não quebra tela nenhuma e ninguém percebe.
 *
 * Foi o que aconteceu com o manifesto: `icon` e `apple-icon` estavam na
 * lista, `manifest.webmanifest` não. Como ele não quebra nenhuma tela,
 * passou. A verificação é contra a resposta HTTP de verdade, e não lendo
 * o `proxy.ts`, pelo mesmo motivo dos cabeçalhos de segurança: o que vale
 * é o que o servidor responde.
 */
test.describe("muro de login", () => {
  // Sem cookie nenhum: é o estado de quem acabou de receber o link.
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * O manifesto é o que faz "adicionar à tela inicial" funcionar, e o
   * navegador o busca antes de qualquer login. Barrado, ele respondia 307
   * para o HTML da tela de entrada — que o navegador não lê como
   * manifesto —, e o PWA deixava de ser instalável para quem ainda não
   * tem conta. Que é exatamente quem se quer converter.
   */
  test("o manifesto do PWA responde sem sessão", async ({ request }) => {
    const resposta = await request.get("/manifest.webmanifest", {
      maxRedirects: 0,
    });

    expect(resposta.status(), "deve responder direto, sem redirecionar").toBe(
      200,
    );

    // E responde um manifesto de verdade, não uma página que por acaso deu
    // 200: `name` e `start_url` são o mínimo para o navegador instalar.
    const manifesto = await resposta.json();
    expect(manifesto.name).toBeTruthy();
    expect(manifesto.start_url).toBe("/");
  });

  /**
   * O webhook de pagamento tem de alcançar a própria rota.
   *
   * Quem chama não é o navegador de ninguém: o Mercado Pago faz um POST
   * sem cookie. Com a rota dentro do matcher, o muro respondia
   * `401 {"erro":"não autenticado"}` antes de o handler existir — a
   * assinatura HMAC nunca era conferida e nenhum pagamento seria
   * confirmado em produção. Nada na tela quebrava: a cobrança abre, o
   * Checkout Pro aparece, a pessoa paga, e só o efeito nunca acontece.
   *
   * O que se afirma aqui é preciso: a resposta tem de vir **da rota**, e
   * não do muro. Por isso a asserção é sobre o corpo, não sobre o status
   * — os dois devolvem 401, e olhar só o número deixaria o bug passar de
   * novo. Sem `x-signature`, a rota recusa dizendo "assinatura inválida";
   * o muro diria "não autenticado".
   */
  test("o webhook de pagamento chega à rota, e a rota é quem recusa", async ({
    request,
  }) => {
    const resposta = await request.post("/api/webhooks/mercado-pago", {
      data: { type: "payment", data: { id: "123456" } },
      maxRedirects: 0,
    });

    const corpo = await resposta.json();

    expect(
      corpo.erro,
      "resposta veio do muro, não da rota — confira o matcher em src/proxy.ts",
    ).not.toBe("não autenticado");

    // E a rota recusa mesmo: sem assinatura válida, não processa nada.
    expect(resposta.status()).toBe(401);
    expect(corpo.erro).toContain("assinatura");
  });

  /**
   * A outra metade, e a que importa mais: abrir o manifesto — e, desde a
   * #241, a home — não pode ter afrouxado o resto do muro. Uma regex mal
   * escrita no matcher derruba a proteção inteira sem quebrar nada visível.
   */
  test("rota de navegação continua barrada sem sessão", async ({ request }) => {
    for (const rota of ["/vagas", "/perfil", "/empresa", "/candidatos"]) {
      const resposta = await request.get(rota, { maxRedirects: 0 });

      expect(
        resposta.status(),
        `${rota} devia redirecionar para o login`,
      ).toBeGreaterThanOrEqual(300);

      expect(resposta.headers().location, `${rota} → destino errado`).toContain(
        "/entrar",
      );
    }
  });

  /** As duas rotas abertas continuam abertas — é por onde se cria conta. */
  test("entrar e cadastro seguem alcançáveis", async ({ request }) => {
    for (const rota of ["/entrar", "/cadastro"]) {
      const resposta = await request.get(rota, { maxRedirects: 0 });
      expect(resposta.status(), `${rota} devia abrir`).toBe(200);
    }
  });

  /**
   * A home saiu do muro na #241: é o que resolve a barreira de conversão
   * de cair direto num formulário sem nunca ver o produto.
   */
  test("a home abre sem sessão", async ({ request }) => {
    const resposta = await request.get("/", { maxRedirects: 0 });
    expect(resposta.status()).toBe(200);
  });

  /**
   * O motivo de a home ter saído do muro: sem sessão, nenhuma página
   * pública existia para o Google indexar. `robots.txt` e `sitemap.xml`
   * são rota gerada, do mesmo jeito que o manifesto — e precisam da mesma
   * exceção no matcher, ou um crawler sem cookie bate num redirecionamento
   * para `/entrar` em vez de encontrar a política.
   */
  test("robots.txt e sitemap.xml respondem sem sessão", async ({ request }) => {
    const robots = await request.get("/robots.txt", { maxRedirects: 0 });
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml", { maxRedirects: 0 });
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  /*
   * A prévia do link no WhatsApp (#259). Três coisas precisam valer juntas,
   * e cada uma já quebrou sozinha em outra rota deste app:
   *
   * - a meta existe — não existia;
   * - aponta para o endereço público, e não para `VERCEL_URL` (#195);
   * - a imagem abre **sem sessão**, porque quem a busca é o servidor do
   *   WhatsApp — o muro já barrou o manifesto do mesmo jeito.
   */
  test("a prévia do link tem imagem, e ela abre sem sessão", async ({
    request,
    baseURL,
  }) => {
    const home = await (await request.get("/")).text();
    const meta = home.match(/<meta property="og:image" content="([^"]+)"/)?.[1];

    expect(meta, "a home não tem og:image").toBeTruthy();
    expect(meta?.startsWith(String(baseURL))).toBe(true);

    const caminho = new URL(String(meta)).pathname;
    const imagem = await request.get(caminho, { maxRedirects: 0 });
    expect(imagem.status()).toBe(200);
    expect(imagem.headers()["content-type"]).toContain("image/png");
  });

  /**
   * O que quase vazou junto com a home: o card de prestador tem um botão
   * de WhatsApp que, autenticado, carrega o telefone de verdade no HTML.
   * Sem sessão, o número não pode estar em lugar nenhum da resposta — não
   * é sobre esconder com CSS, é sobre nunca ter sido lido para dentro do
   * JSX (`src/components/provider-card.tsx`).
   */
  test("a home não expõe telefone de prestador sem sessão", async ({
    request,
  }) => {
    const resposta = await request.get("/");
    const html = await resposta.text();
    expect(html).not.toContain("wa.me");
  });
});
