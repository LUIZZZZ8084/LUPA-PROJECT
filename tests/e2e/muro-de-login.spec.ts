import { expect, test } from "@playwright/test";

/**
 * O muro de login, e o que fica de fora dele.
 *
 * O app é fechado por decisão de produto: sem conta não se navega. Mas o
 * muro roda na borda, antes de a página existir, e o que ele cobre é
 * decidido por uma expressão regular no `matcher` de `src/proxy.ts` — o
 * tipo de lugar onde um item esquecido não quebra tela nenhuma e ninguém
 * percebe.
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
   * A outra metade, e a que importa mais: abrir o manifesto não pode ter
   * afrouxado o muro. Uma regex mal escrita no matcher derruba a proteção
   * inteira sem quebrar nada visível.
   */
  test("rota de navegação continua barrada sem sessão", async ({ request }) => {
    for (const rota of ["/", "/vagas", "/perfil", "/empresa", "/candidatos"]) {
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
});
