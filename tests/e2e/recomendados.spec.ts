import { expect, test } from "@playwright/test";

/**
 * "Recomendados para você", no navegador.
 *
 * O que se confere é o que faz a empresa confiar no bloco: que ele diz
 * **por que** cada pessoa está ali. Recomendação sem motivo é adivinhação
 * — quem recebe não tem como discordar do critério, e na primeira vez que
 * discordar em silêncio para de olhar.
 */
test.describe("recomendados para você", () => {
  test("aparece e diz de onde vem a lista", async ({ page }) => {
    await page.goto("/empresa");

    await expect(page.getByText("Recomendados para você")).toBeVisible();
    // O bloco diz de onde vem a lista e por que a ordem é essa.
    await expect(
      page.getByText(/do mais perto do local da vaga/i),
    ).toBeVisible();
    // Uma por vaga aberta com recomendação; basta a primeira existir.
    await expect(
      page.getByRole("heading", { name: /entre quem se candidatou/i }).first(),
    ).toBeVisible();
  });

  test("cada recomendado mostra quais habilidades casaram", async ({
    page,
  }) => {
    await page.goto("/empresa");

    const primeiro = page.getByText(/\d+ de \d+ habilidades/).first();
    await expect(primeiro).toBeVisible();

    /*
     * O selo tem que trazer o texto da habilidade, não só a contagem: é o
     * que permite a empresa conferir o critério em vez de acreditar nele.
     */
    const cartao = primeiro.locator("xpath=..");
    const selos = await cartao.locator("span").allTextContents();
    expect(selos.filter((s) => s.trim().length > 2).length).toBeGreaterThan(0);
  });

  test("o recomendado leva para a ficha dele", async ({ page }) => {
    await page.goto("/empresa");

    const bloco = page
      .locator("section")
      .filter({ hasText: "Recomendados para você" });
    await bloco.locator('a[href^="/empresa/candidaturas/"]').first().click();

    await expect(page).toHaveURL(/\/empresa\/candidaturas\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  /**
   * O campo é o que faz a recomendação melhorar. Se ele sumir do
   * formulário, o bloco continua funcionando pelo texto da vaga e ninguém
   * percebe que a empresa perdeu o controle sobre o critério.
   */
  test("a vaga tem onde declarar as habilidades", async ({ page }) => {
    await page.goto("/empresa/vagas/nova");

    const campo = page.getByLabel("Habilidades desejadas");
    await expect(campo).toBeVisible();
    await expect(campo).toHaveAttribute("name", "habilidades");
  });
});
