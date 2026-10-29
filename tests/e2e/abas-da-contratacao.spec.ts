import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * As abas da área de contratação (#511, #515), pelo caminho de quem clica.
 *
 * "Candidatos" é a aba do funil, e Planos saiu das abas: é página à parte,
 * aberta pelo cartão da empresa no painel, com o caminho de volta.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

const abas = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: /Seções de/ });

test("a aba Candidatos abre o funil", async ({ page }) => {
  await page.goto("/empresa");

  await abas(page).getByRole("link", { name: "Candidatos" }).click();

  await expect(page).toHaveURL(/\/empresa\/funil$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Candidatos" }),
  ).toBeVisible();
  await expect(abas(page).getByRole("link", { name: /Planos/ })).toHaveCount(0);
});

test("planos abre pelo cartão da empresa, fora das abas, e volta ao painel", async ({
  page,
}) => {
  await page.goto("/empresa");

  await page.getByRole("link", { name: "Ver planos" }).click();

  await expect(page).toHaveURL(/\/empresa\/creditos$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Planos e vagas" }),
  ).toBeVisible();
  await expect(abas(page)).toHaveCount(0);

  await page.getByRole("link", { name: "Voltar ao painel" }).click();
  await expect(page).toHaveURL(/\/empresa$/);
});
