import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA, aguardarHidratacao } from "./helpers";

/**
 * Candidatos em lista e Talentos com guardados e convite (#620).
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

test("a aba Candidatos alterna entre quadro e lista, e a lista abre a ficha", async ({
  page,
}) => {
  await page.goto("/empresa/funil");
  await page
    .getByRole("navigation", { name: "Ver candidatos em" })
    .getByRole("link", { name: "Lista" })
    .click();
  await expect(page).toHaveURL(/\/empresa\/candidaturas$/);
  await expect(page.getByRole("link", { name: "Candidatos" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const linhas = page.locator('main ul a[href^="/empresa/candidaturas/"]');
  expect(await linhas.count()).toBeGreaterThan(0);
  await linhas.first().click();
  await expect(page).toHaveURL(/\/empresa\/candidaturas\/[^/]+$/);
});

test("a lista filtra por nome e por etapa, e diz quando ninguém casa", async ({
  page,
}) => {
  await page.goto("/empresa/candidaturas?q=zzzzz");
  await expect(page.getByText("Ninguém com esses filtros")).toBeVisible();

  await page.goto("/empresa/candidaturas?estagio=entrevista");
  const etapas = page.locator("main ul li").getByText("Entrevista", {
    exact: true,
  });
  const linhas = page.locator('main ul a[href^="/empresa/candidaturas/"]');
  await expect(linhas.first()).toBeVisible();
  expect(await etapas.count()).toBe(await linhas.count());
});

test("talentos: só os guardados, convite com a vaga, e passa no axe", async ({
  page,
}) => {
  await page.goto("/empresa/talentos?guardados=sim");
  await expect(
    page
      .getByText("Ninguém guardado ainda")
      .or(page.getByText("Guardado", { exact: true }).first()),
  ).toBeVisible();

  await page.addInitScript(() => {
    (window as unknown as { __aberto: string[] }).__aberto = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __aberto: string[] }).__aberto.push(String(url));
      return null;
    };
  });
  await page.goto("/empresa/talentos");
  await aguardarHidratacao(page, "button[aria-label^=Convidar]");
  await page.locator("button[aria-label^=Convidar]").first().click();
  const aberto = await page.evaluate(
    () => (window as unknown as { __aberto: string[] }).__aberto[0],
  );
  expect(decodeURIComponent(aberto)).toMatch(
    /^https:\/\/wa\.me\/55\d+\?text=Olá, .+ candidate-se pela Lupa: http.+\/vagas\//,
  );

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
