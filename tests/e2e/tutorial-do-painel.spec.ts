import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA, aguardarAnimacoes } from "./helpers";

/**
 * O tutorial de primeira visita do painel (#513), num navegador de verdade.
 *
 * O teste de componente prova os passos e o fechar. Aqui fica o que só o
 * navegador responde: o tutorial aparece depois da hidratação, fechado não
 * volta ao recarregar, e aberto passa no axe e cabe no celular. Cada teste
 * começa com o storage vazio, como o aparelho de quem nunca abriu o painel.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

const tutorial = (page: import("@playwright/test").Page) =>
  page.getByRole("region", {
    name: /Publique uma vaga|Acompanhe|Chame|Procure/,
  });

test("aparece na primeira visita e, fechado, não volta", async ({ page }) => {
  await page.goto("/empresa");

  await expect(tutorial(page)).toBeVisible();
  await expect(page.getByText(/Como funciona o painel · 1 de 4/)).toBeVisible();

  await page.getByRole("button", { name: "Próximo" }).click();
  await expect(
    page.getByRole("heading", { name: "Acompanhe no Funil" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Pular" }).click();
  await expect(tutorial(page)).toBeHidden();

  await page.reload();
  // O resumo já carregou: se o tutorial fosse voltar, já teria voltado.
  await expect(page.getByRole("heading", { name: "Para hoje" })).toBeVisible();
  await expect(tutorial(page)).toBeHidden();
});

test("aberto, passa no axe e não empurra a página para o lado", async ({
  page,
}) => {
  await page.goto("/empresa");
  await expect(tutorial(page)).toBeVisible();
  await aguardarAnimacoes(page);

  const { violations } = await new AxeBuilder({ page })
    .include("section[aria-labelledby='tutorial-do-painel']")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  const largura = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    tela: window.innerWidth,
  }));
  expect(largura.pagina).toBeLessThanOrEqual(largura.tela);
});
