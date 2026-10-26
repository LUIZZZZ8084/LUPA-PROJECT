import { expect, type Page, test } from "@playwright/test";

/**
 * A cor da barra do navegador acompanha o tema (#479).
 *
 * O `theme-color` era fixo em claro: no tema escuro a barra do Android e a do
 * app instalado ficavam claras sobre uma tela escura. Aqui se confere no
 * navegador de verdade, onde a ordem das `<meta>` que o Next escreve e a
 * hidratação podiam desfazer o que o script do `<head>` fez: a cor que vale é
 * a da primeira `<meta name="theme-color">`, e tem de ser a do fundo da página.
 */
const SEM_SESSAO = { cookies: [], origins: [] };
const CLARO = "#f7f8fa";
const ESCURO = "#0b0f14";

/** A cor que o navegador usaria: a da primeira meta, em hexadecimal minúsculo. */
function corDaBarra(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content")
        ?.toLowerCase() ?? null,
  );
}

/** O fundo da página, convertido para o mesmo formato. */
function fundoDaPagina(page: Page) {
  return page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body)
      .backgroundColor.match(/\d+/g)
      ?.map(Number) ?? [0, 0, 0];
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  });
}

test.describe("barra do navegador e tema", () => {
  test.use({ storageState: SEM_SESSAO });

  test("quem já escolheu o escuro abre com a barra escura, igual ao fundo", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("lupa:tema", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    expect(await corDaBarra(page)).toBe(ESCURO);
    expect(await fundoDaPagina(page)).toBe(ESCURO);
  });

  test("no claro, a barra é a clara, igual ao fundo", async ({ page }) => {
    await page.goto("/");

    expect(await corDaBarra(page)).toBe(CLARO);
    expect(await fundoDaPagina(page)).toBe(CLARO);
  });

  test("o botão de tema leva a barra junto, nos dois sentidos", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Mudar para o tema escuro" })
      .click();
    expect(await corDaBarra(page)).toBe(ESCURO);

    await page.getByRole("button", { name: "Mudar para o tema claro" }).click();
    expect(await corDaBarra(page)).toBe(CLARO);
  });

  test("a escolha e a barra sobrevivem a recarregar e a navegar", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Mudar para o tema escuro" })
      .click();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await corDaBarra(page)).toBe(ESCURO);

    // Navegação do lado do cliente: o Next pode refazer a meta dele. A
    // nossa, primeira do <head>, é a que vale.
    await page.getByRole("link", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/entrar/);
    expect(await corDaBarra(page)).toBe(ESCURO);
  });
});
