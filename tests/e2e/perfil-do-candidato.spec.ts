import { expect, test } from "@playwright/test";

/**
 * O candidato abrindo a própria prévia.
 *
 * Duas coisas se cruzam aqui, e é o cruzamento que importa: a busca de
 * candidatos continua fechada para quem não é empresa, e ainda assim o
 * candidato precisa alcançar `/candidatos/<o próprio id>` — que é onde
 * ficam as fotos do trabalho dele e onde ele as adiciona.
 *
 * O portão roda na borda, antes de a página existir, e é o tipo de lugar
 * onde um prefixo a mais fecha uma rota sem quebrar tela nenhuma. Por isso
 * a verificação é contra a resposta de verdade, pelo caminho que a pessoa
 * percorre — e não lendo o `proxy.ts`.
 *
 * Usa a sessão de candidato que o setup já deixou pronta: criar conta aqui
 * gastaria uma das cinco que o limite por origem permite em 15 minutos.
 */
test.describe("perfil do candidato", () => {
  /**
   * A busca de candidatos é da empresa, e continua sendo.
   *
   * 404 e não 403: confirmar que a área existe é informação de graça para
   * quem está sondando.
   */
  test("a busca de candidatos continua fechada", async ({ page }) => {
    const resposta = await page.goto("/candidatos");
    expect(resposta?.status()).toBe(404);
  });

  test("o perfil abre pelo atalho do próprio perfil, com as duas abas", async ({
    page,
  }) => {
    await page.goto("/perfil");

    const atalho = page.getByRole("link", { name: "Ver como você aparece" });
    await expect(atalho).toBeVisible();
    await atalho.click();

    await expect(page).toHaveURL(/\/candidatos\/[^/]+$/);

    // As duas abas do desenho, e nada de avaliação.
    await expect(page.getByRole("tab", { name: "Sobre mim" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Serviços" })).toBeVisible();
    await expect(page.getByText("Avaliações")).toHaveCount(0);
  });

  /**
   * O aviso de invisível existe porque o consentimento nasce desligado —
   * de propósito, já que o patrão atual pode estar entre as empresas
   * cadastradas. Sem dizer isso na cara de quem abre a prévia, a pessoa
   * conclui que o perfil dela está quebrado.
   */
  test("avisa que só ele vê o perfil, e oferece onde ligar", async ({
    page,
  }) => {
    await page.goto("/perfil");
    await page.getByRole("link", { name: "Ver como você aparece" }).click();

    await expect(page.getByText("Só você vê este perfil")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ligar no perfil" }),
    ).toHaveAttribute("href", "/perfil/editar");
  });

  /** Na aba Serviços é onde ele publica — sem passar por outra tela. */
  test("a aba Serviços traz o botão de adicionar trabalho", async ({
    page,
  }) => {
    await page.goto("/perfil");
    await page.getByRole("link", { name: "Ver como você aparece" }).click();

    await page.getByRole("tab", { name: "Serviços" }).click();

    await expect(
      page.getByRole("button", { name: /Adicionar trabalho/i }),
    ).toBeVisible();
  });
});
