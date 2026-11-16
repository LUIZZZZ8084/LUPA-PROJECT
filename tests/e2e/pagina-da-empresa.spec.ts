import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO } from "./helpers";

/**
 * A página pública da empresa (#616): o nome dela na vaga leva até lá, e
 * ela mostra as vagas abertas. Abre sem login; site e redes só com sessão.
 */
const VAGA = "/vagas/job-operador-maquinas";
const EMPRESA = "/empresas/cmp-agro-norte";

test.describe("página da empresa, sem sessão", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("o nome da empresa na vaga leva à página dela", async ({ page }) => {
    await page.goto(VAGA);
    await page
      .getByRole("main")
      .getByRole("link", { name: "Agro Norte Ltda." })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${EMPRESA}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Agro Norte Ltda.",
    );
  });

  test("lista as vagas abertas e não mostra contato", async ({ page }) => {
    const resposta = await page.goto(EMPRESA);
    expect(resposta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /vagas? abertas?/i }),
    ).toBeVisible();
    await expect(page.locator(`main a[href="${VAGA}"]`)).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Instagram" }),
    ).toHaveCount(0);
  });

  test("passa no axe", async ({ page }) => {
    await page.goto(EMPRESA);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test("empresa que não existe responde 404", async ({ page }) => {
    const resposta = await page.goto("/empresas/empresa-que-nao-existe");
    expect(resposta?.status()).toBe(404);
  });
});

test.describe("página da empresa, com sessão", () => {
  test.use({ storageState: ARQUIVO_SESSAO });

  test("site e redes aparecem para quem tem conta", async ({ page }) => {
    await page.goto(EMPRESA);
    await expect(
      page.getByRole("main").getByRole("link", { name: "Instagram" }),
    ).toBeVisible();
  });
});
