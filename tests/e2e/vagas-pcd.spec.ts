import { expect, test } from "@playwright/test";

/**
 * O filtro de vaga para PCD (#456), pelo caminho que a pessoa percorre.
 *
 * Na demonstração duas vagas de exemplo são para PCD. As outras specs
 * publicam vagas durante a corrida e a lista é compartilhada, então aqui
 * se confere a regra — toda vaga listada leva o selo —, e não a contagem.
 */
test.describe("filtro de vagas para PCD", () => {
  const CARTOES = 'main a[href^="/vagas/"]';

  test("com o filtro, só aparecem vagas para PCD", async ({ page }) => {
    await page.goto("/vagas?pcd=sim");

    const cartoes = page.locator(CARTOES);
    await expect(cartoes.first()).toBeVisible();
    const total = await cartoes.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      await expect(
        cartoes.nth(i).getByText("Vaga para PCD"),
        "toda vaga listada com o filtro leva o selo",
      ).toBeVisible();
    }
  });

  test("sem o filtro, aparecem também as que não são para PCD", async ({
    page,
  }) => {
    await page.goto("/vagas");

    const todas = await page.locator(CARTOES).count();
    await page.goto("/vagas?pcd=sim");
    const soPcd = await page.locator(CARTOES).count();

    expect(todas).toBeGreaterThan(soPcd);
  });

  test("o filtro se escolhe na tela, e o valor sobra na URL", async ({
    page,
  }) => {
    await page.goto("/vagas");

    await page.getByRole("combobox", { name: "PCD" }).selectOption("sim");

    await expect(page).toHaveURL(/pcd=sim/);
    await expect(
      page.locator(CARTOES).first().getByText("Vaga para PCD"),
    ).toBeVisible();
  });

  /*
   * #460: o select de cada filtro existe mesmo quando o chip está fora da
   * tela, então "achar o combobox" não prova que a pessoa acha o filtro. A
   * fileira antiga rolava para o lado sem barra, e no celular o de PCD —
   * o último — nascia cortado na borda. Aqui o que se confere é estar
   * inteiro dentro da tela, na largura do aparelho.
   */
  test("todos os filtros cabem na tela, e o de PCD diz PCD", async ({
    page,
  }) => {
    await page.goto("/vagas");

    for (const nome of ["uf", "categoria", "tipo", "pcd"]) {
      await expect(
        page.locator(`form select[name="${nome}"]`),
        `o filtro ${nome} aparece inteiro, sem rolar para o lado`,
      ).toBeInViewport({ ratio: 1 });
    }

    await expect(
      page.locator("form").getByText("PCD", { exact: true }),
    ).toBeVisible();
  });

  test("valor torto na URL é 'todas as vagas', e não uma lista vazia", async ({
    page,
  }) => {
    await page.goto("/vagas");
    const todas = await page.locator(CARTOES).count();

    await page.goto("/vagas?pcd=talvez");
    await expect(page.locator(CARTOES)).toHaveCount(todas);
  });

  test("a vaga para PCD mostra o selo na própria página", async ({ page }) => {
    await page.goto("/vagas/job-auxiliar-adm");
    await expect(page.getByText("Vaga para PCD")).toBeVisible();

    await page.goto("/vagas/job-operador-maquinas");
    await expect(page.getByText("Vaga para PCD")).toHaveCount(0);
  });
});
