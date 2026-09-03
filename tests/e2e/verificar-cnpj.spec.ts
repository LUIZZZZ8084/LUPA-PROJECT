import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * O convite para conferir o CNPJ na Receita.
 *
 * Aqui se confere a fiação — que o convite aparece para a empresa que
 * ainda não é verificada, e que ele diz o que vai acontecer. **O clique
 * não é exercitado de propósito:** ele consulta a BrasilAPI, e suíte que
 * fala com API de terceiro falha vermelho sem ninguém ter mexido em nada.
 * O que a consulta decide está travado em teste de unidade, com o `fetch`
 * injetado.
 */
test.describe("conferência de CNPJ", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("a empresa não verificada recebe o convite", async ({ page }) => {
    await page.goto("/perfil");

    await expect(
      page.getByText("Sua empresa ainda não é verificada"),
    ).toBeVisible();

    // O botão diz o que faz, e a explicação diz o que se ganha com ele.
    await expect(
      page.getByRole("button", { name: "Conferir CNPJ agora" }),
    ).toBeEnabled();
    await expect(page.getByText(/sem enviar documento/)).toBeVisible();
  });
});

/**
 * O candidato não tem CNPJ, e o convite não é dele.
 *
 * Em `describe` separado por causa da sessão: limpar cookie no meio do
 * outro bloco derrubaria a pessoa no login, e aí o convite sumiria por
 * falta de sessão — o teste passaria pelo motivo errado.
 *
 * Botão que aparece para quem não pode usá-lo é a armadilha do "só recusa
 * depois do clique" que este projeto já pagou mais de uma vez.
 */
test.describe("conferência de CNPJ, para quem não tem CNPJ", () => {
  test("o candidato entra no próprio perfil e não vê o convite", async ({
    page,
  }) => {
    await page.goto("/perfil");

    // Confirma que há sessão: sem isto o teste passaria só por estar no login.
    await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
    await expect(page.getByText("Conferir CNPJ agora")).toHaveCount(0);
    await expect(
      page.getByText("Sua empresa ainda não é verificada"),
    ).toHaveCount(0);
  });
});
