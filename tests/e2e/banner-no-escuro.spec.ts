import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * O banner da home tem uma foto por tema (#374).
 *
 * A clara, da arte original, no tema claro; o homem recortado do fundo, no
 * escuro. O tema é uma escolha guardada no navegador (`lupa:tema`) e lida
 * por um script antes da primeira pintura, então aqui ela é posta antes de
 * a página carregar, como faz quem já tinha escolhido o escuro.
 *
 * A home é pública: sem sessão, que é como quem recebe o link a vê.
 */
const SEM_SESSAO = { cookies: [], origins: [] };

async function fotoCarregada(
  page: import("@playwright/test").Page,
  trecho: string,
) {
  await page.waitForFunction((t) => {
    const img = document.querySelector<HTMLImageElement>(`img[src*="${t}"]`);
    return Boolean(img?.complete && img.naturalWidth > 0);
  }, trecho);
}

test.describe("banner da home, tema escuro", () => {
  test.use({ storageState: SEM_SESSAO });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lupa:tema", "dark"));
  });

  test("mostra o recorte e esconde a foto clara", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('img[src*="trabalhador-escuro"]')).toBeVisible();
    await expect(page.locator('img[src*="trabalhador.webp"]')).toBeHidden();
    await fotoCarregada(page, "trabalhador-escuro");
  });

  /**
   * O contraste do título e da frase sobre o fundo verde escuro. Só o banner
   * é medido: o resto da home no escuro tem a sua própria história, e uma
   * violação de fora não pode esconder uma de dentro nem o contrário.
   */
  test("o banner não tem violações de acessibilidade no escuro", async ({
    page,
  }) => {
    await page.goto("/");
    await fotoCarregada(page, "trabalhador-escuro");

    const resultado = await new AxeBuilder({ page })
      .include("section:has(h1)")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      resultado.violations.map((v) => ({
        regra: v.id,
        elementos: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 100)),
      })),
    ).toEqual([]);
  });

  test("sem rolagem horizontal no celular", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await fotoCarregada(page, "trabalhador-escuro");

    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
  });
});

test.describe("banner da home, tema claro", () => {
  test.use({ storageState: SEM_SESSAO });

  test("mostra a foto clara e esconde o recorte", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lupa:tema", "light"));
    await page.goto("/");

    await expect(page.locator('img[src*="trabalhador.webp"]')).toBeVisible();
    await expect(page.locator('img[src*="trabalhador-escuro"]')).toBeHidden();
  });
});
