import { expect, test } from "@playwright/test";
import { entrarComoTeste, SENHA_DE_TESTE } from "./helpers";

/**
 * Sair dos outros aparelhos (#402), com dois aparelhos de verdade.
 *
 * O que só o navegador prova: a sessão do outro aparelho cai na próxima
 * navegação, e a de quem clicou continua — a ordem corte, cache, sessão
 * nova é a que decide isso, e um teste de unidade não a exercita inteira.
 *
 * Conta própria, e não a compartilhada da suíte: cortar as sessões da
 * conta compartilhada derrubaria os testes que rodam em paralelo com ela.
 * Origem própria para o limite de cadastro, como os outros specs que
 * criam conta.
 */
// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo na coleta quando o parâmetro é nomeado.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "cria conta; basta um projeto");
});

test.describe("sair dos outros aparelhos", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "x-forwarded-for": "203.0.113.94" },
  });

  test("o outro aparelho sai, e este continua dentro", async ({
    page,
    browser,
  }) => {
    const email = await entrarComoTeste(page);

    // O segundo aparelho entra na mesma conta.
    const outro = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { "x-forwarded-for": "203.0.113.94" },
    });
    const celular = await outro.newPage();
    await celular.goto("/entrar");
    await celular.getByLabel("E-mail").fill(email);
    await celular.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await celular.getByRole("button", { name: "Entrar" }).click();
    await celular.waitForURL((url) => !url.pathname.startsWith("/entrar"));
    await celular.goto("/perfil");
    await expect(
      celular.getByRole("button", { name: "Sair da conta" }),
    ).toBeVisible();

    // Daqui, sair dos outros.
    await page.goto("/perfil");
    await page
      .getByRole("button", { name: "Sair dos outros aparelhos" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Os outros aparelhos saem da sua conta",
    );

    /*
     * O outro aparelho cai na próxima navegação. Ele continua em `/perfil`:
     * o proxy só confere se há cookie, e quem decide que a sessão foi
     * revogada é `sessaoAtual()` — a página então mostra o convite para
     * entrar, e o cabeçalho volta a oferecer "Entrar".
     */
    await celular.goto("/perfil");
    await expect(
      celular
        .getByRole("banner")
        .getByRole("link", { name: "Entrar", exact: true }),
    ).toBeVisible();
    await expect(
      celular.getByRole("button", { name: "Sair da conta" }),
    ).toHaveCount(0);

    // Este continua dentro.
    await page.goto("/perfil");
    await expect(
      page.getByRole("button", { name: "Sair da conta" }),
    ).toBeVisible();

    await outro.close();
  });
});
