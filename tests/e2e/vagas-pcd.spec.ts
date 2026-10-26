import { expect, test } from "@playwright/test";

/**
 * O filtro de vaga para PCD (#456), pelo caminho que a pessoa percorre.
 *
 * Ele mora dentro da lista de Tipo (#463): `?tipo=pcd`.
 *
 * Na demonstração duas vagas de exemplo são para PCD. As outras specs
 * publicam vagas durante a corrida e a lista é compartilhada, então aqui
 * se confere a regra — toda vaga listada leva o selo —, e não a contagem.
 */
test.describe("filtro de vagas para PCD", () => {
  const CARTOES = 'main a[href^="/vagas/"]';

  test("com o filtro, só aparecem vagas para PCD", async ({ page }) => {
    await page.goto("/vagas?tipo=pcd");

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
    await page.goto("/vagas?tipo=pcd");
    const soPcd = await page.locator(CARTOES).count();

    expect(todas).toBeGreaterThan(soPcd);
  });

  test("a opção está na lista de Tipo, e escolher liga o filtro", async ({
    page,
  }) => {
    await page.goto("/vagas");

    const tipo = page.getByRole("combobox", { name: "Tipo" });
    await expect(
      tipo.locator("option", { hasText: "Vaga para PCD" }),
      "a opção de PCD é uma das da lista de Tipo",
    ).toHaveCount(1);

    await tipo.selectOption("pcd");

    await expect(page).toHaveURL(/tipo=pcd/);
    await expect(
      page.locator(CARTOES).first().getByText("Vaga para PCD"),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "PCD" }),
      "não sobrou um filtro separado de PCD na barra",
    ).toHaveCount(0);
  });

  /*
   * #460: o select de cada filtro existe mesmo quando o chip está fora da
   * tela, então "achar o combobox" não prova que a pessoa acha o filtro. A
   * fileira antiga rolava para o lado sem barra, e o que passasse do
   * terceiro chip nascia cortado na borda do celular. Com um estado
   * escolhido a cidade aparece, são quatro chips, e é aí que a fileira
   * antiga cortava — por isso o estado vem na URL.
   */
  test("todos os filtros cabem na tela, sem rolar para o lado", async ({
    page,
  }) => {
    await page.goto("/vagas?uf=MT");

    for (const nome of ["uf", "cidade", "categoria", "tipo"]) {
      await expect(
        page.locator(`form select[name="${nome}"]`),
        `o filtro ${nome} aparece inteiro, sem rolar para o lado`,
      ).toBeInViewport({ ratio: 1 });
    }
  });

  /*
   * O filtro nasceu como `?pcd=sim` (#456) e viveu um dia antes de ir para
   * dentro de Tipo (#463). O endereço antigo não filtra nada: parâmetro que
   * a página não conhece é "todas as vagas", e não uma lista vazia.
   */
  test("o endereço antigo, ?pcd=sim, mostra todas as vagas", async ({
    page,
  }) => {
    await page.goto("/vagas");
    const todas = await page.locator(CARTOES).count();

    await page.goto("/vagas?pcd=sim");
    await expect(page.locator(CARTOES)).toHaveCount(todas);
  });

  test("a vaga para PCD mostra o selo na própria página", async ({ page }) => {
    await page.goto("/vagas/job-auxiliar-adm");
    await expect(page.getByText("Vaga para PCD")).toBeVisible();

    await page.goto("/vagas/job-operador-maquinas");
    await expect(page.getByText("Vaga para PCD")).toHaveCount(0);
  });
});
