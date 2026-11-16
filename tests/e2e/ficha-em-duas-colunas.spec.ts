import { expect, type Page, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * A ficha do candidato com a etapa no alto e, no computador, em duas
 * colunas (#625).
 */
async function abrirUmaFicha(page: Page) {
  await page.goto("/empresa/candidaturas");
  const href = await page
    .locator('main a[href^="/empresa/candidaturas/"]')
    .first()
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href as string);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("ficha do candidato", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("a etapa vem logo depois do contato, antes do currículo", async ({
    page,
  }) => {
    await abrirUmaFicha(page);
    const etapa = await page
      .getByRole("heading", { name: "Estágio no seu processo" })
      .boundingBox();
    const sobre = await page
      .getByRole("heading", { name: "Sobre a pessoa" })
      .boundingBox();
    expect(etapa && sobre && etapa.y < sobre.y).toBe(true);
  });

  test("voltar leva aos candidatos", async ({ page }) => {
    await abrirUmaFicha(page);
    await expect(
      page.getByRole("link", { name: "Voltar para os candidatos" }),
    ).toHaveAttribute("href", "/empresa/candidaturas");
  });

  test("no computador, anotações ao lado da pessoa", async ({ page }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "duas colunas só a partir de lg",
    );
    await abrirUmaFicha(page);
    const sobre = await page
      .getByRole("heading", { name: "Sobre a pessoa" })
      .boundingBox();
    const anotacoes = await page
      .getByRole("heading", { name: "Anotações e entrevista" })
      .boundingBox();
    expect(sobre && anotacoes && anotacoes.x > sobre.x + 200).toBe(true);
    expect(anotacoes && anotacoes.y < 800).toBe(true);
  });

  test("no celular, o botão de copiar o e-mail tem alvo de toque", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "alvo de 44 px só no toque");
    await abrirUmaFicha(page);
    const copiar = page.getByRole("button", { name: /^Copiar/ });
    test.skip((await copiar.count()) === 0, "candidato sem e-mail");
    const caixa = await copiar.boundingBox();
    expect(caixa && caixa.height >= 44).toBe(true);
  });
});
