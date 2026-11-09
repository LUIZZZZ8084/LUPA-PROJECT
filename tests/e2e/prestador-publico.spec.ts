import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { aguardarAnimacoes } from "./helpers";

/**
 * O perfil do prestador abre sem login, só para leitura (#603).
 *
 * É o link que o prestador posta no status e manda ao cliente para pedir
 * avaliação. O que só o navegador prova: responde 200 sem sessão, nenhum
 * telefone nem `wa.me` no HTML, o nome de quem avaliou sai abreviado, e a
 * âncora `#avaliar` cai no convite para entrar, que volta para o mesmo ponto.
 */
const PERFIL = "/servicos/prv-joao-silva";

test.describe("perfil de prestador público", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("abre sem login, com o perfil e sem contato nenhum", async ({
    page,
  }) => {
    const resposta = await page.goto(PERFIL);

    expect(resposta?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(PERFIL);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const html = await page.locator("main").innerHTML();
    expect(html, "WhatsApp no perfil público").not.toMatch(/wa\.me/);
    expect(html, "telefone no perfil público").not.toMatch(/href="tel:/);
    await expect(
      page.getByRole("link", {
        name: "Entrar para ver o contato",
        exact: true,
      }),
    ).toHaveAttribute("href", /destino=%2Fservicos%2Fprv-joao-silva/);
    await expect(page.getByRole("button", { name: /denunciar/i })).toHaveCount(
      0,
    );
  });

  test("o nome de quem avaliou sai abreviado", async ({ page }) => {
    await page.goto(PERFIL);
    const main = page.locator("main");
    await expect(main.getByText("Edson V.", { exact: true })).toBeVisible();
    await expect(main.getByText("Edson Vargas")).toHaveCount(0);
  });

  test("o link de pedir avaliação cai no convite para entrar, que volta para cá", async ({
    page,
  }) => {
    await page.goto(`${PERFIL}#avaliar`);
    const convite = page.locator("#avaliar");
    await expect(convite).toBeInViewport();
    await expect(
      convite.getByRole("link", { name: "Entrar para avaliar" }),
    ).toHaveAttribute(
      "href",
      `/entrar?destino=${encodeURIComponent(`${PERFIL}#avaliar`)}`,
    );
  });

  test("passa no axe sem sessão", async ({ page }) => {
    await page.goto(PERFIL);
    await expect(page.locator("main").getByText("Edson V.")).toBeVisible();
    await aguardarAnimacoes(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test("a lista de serviços continua pedindo login", async ({ page }) => {
    await page.goto("/servicos");
    expect(new URL(page.url()).pathname).toBe("/entrar");
  });
});
