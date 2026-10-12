import { expect, test } from "@playwright/test";
import { entrarComoTeste, SENHA_DE_TESTE } from "./helpers";

/**
 * Excluir a própria conta (#423), pelo caminho que a pessoa percorre.
 *
 * O que só o navegador prova: o formulário fica fechado até ser pedido,
 * a confirmação é exigida, a senha errada não exclui, e a certa leva ao
 * login com o aviso — e a mesma senha não entra mais.
 *
 * Conta própria e origem própria, como os outros specs que criam conta:
 * excluir a conta compartilhada derrubaria a suíte inteira.
 */
// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo na coleta quando o parâmetro é nomeado.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "cria conta; basta um projeto");
});

test.describe("excluir a própria conta", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { "x-forwarded-for": "203.0.113.95" },
  });

  test("com a senha e a confirmação, a conta sai e não entra mais", async ({
    page,
  }) => {
    const email = await entrarComoTeste(page);
    await page.goto("/perfil");

    // Fechado até a pessoa pedir.
    await expect(page.getByLabel("Sua senha")).toHaveCount(0);
    await page.getByRole("button", { name: "Excluir minha conta" }).click();

    // Senha errada: nada é excluído, e o campo diz o que errou.
    await page.getByLabel("Sua senha").fill("senha-que-nao-e");
    await page.getByLabel("Entendo que a exclusão não tem volta").check();
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await expect(page.getByText("Senha incorreta.")).toBeVisible();

    // Senha certa.
    await page.getByLabel("Sua senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: "Excluir minha conta" }).click();

    await expect(page).toHaveURL(/\/entrar\?conta=excluida/);
    await expect(page.getByText(/Sua conta foi excluída/)).toBeVisible();

    // A sessão saiu: o perfil manda ao login.
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/entrar/);

    // E a mesma senha não entra mais.
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/e-mail ou senha/i)).toBeVisible();
  });
});
