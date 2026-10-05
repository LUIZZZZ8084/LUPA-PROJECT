import { expect, test } from "@playwright/test";

/**
 * A busca do hero e a troca entre Vagas e Serviços (#341).
 *
 * O que só o navegador responde: o formulário do hero chega à lista com os
 * filtros preenchidos, o visitante cai no login com a busca guardada, e o
 * alternador do topo das listas leva o termo de uma lista para a outra.
 */
test.describe("busca no hero, com sessão", () => {
  test("a busca de vagas chega à lista com o termo", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("searchbox").fill("auxiliar");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/vagas\?q=auxiliar$/);
    await expect(page.getByRole("searchbox")).toHaveValue("auxiliar");
  });

  test("Serviços no hero leva a busca para /servicos", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Serviços" }).click();
    await page.getByRole("searchbox").fill("diarista");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/servicos\?q=diarista$/);
  });

  /** Os atalhos são links para a lista, já no filtro de categoria. */
  test("um atalho abre a lista no filtro de categoria", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Serviços" }).click();
    await page.getByRole("link", { name: "Diarista" }).click();

    await expect(page).toHaveURL(/\/servicos\?categoria=diarista$/);
  });
});

test.describe("alternador nas listas", () => {
  test("leva o termo de vagas para serviços e de volta", async ({ page }) => {
    await page.goto("/vagas?q=limpeza");

    const nav = page.getByRole("navigation", { name: "Tipo de busca" });
    await expect(nav.getByRole("link", { name: "Vagas" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await nav.getByRole("link", { name: "Serviços" }).click();
    await expect(page).toHaveURL(/\/servicos\?q=limpeza$/);
    await expect(page.getByRole("searchbox")).toHaveValue("limpeza");

    await page
      .getByRole("navigation", { name: "Tipo de busca" })
      .getByRole("link", { name: "Vagas" })
      .click();
    await expect(page).toHaveURL(/\/vagas\?q=limpeza$/);
  });

  /** Categoria de vaga não é slug de serviço: levar esvaziaria a outra lista. */
  test("não leva a categoria para a outra lista", async ({ page }) => {
    await page.goto("/vagas?q=limpeza&categoria=Administrativo");

    await page
      .getByRole("navigation", { name: "Tipo de busca" })
      .getByRole("link", { name: "Serviços" })
      .click();

    await expect(page).toHaveURL(/\/servicos\?q=limpeza$/);
  });
});

test.describe("busca no hero, sem conta", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("avisa antes do clique e termina no login com a busca guardada", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/entre ou crie sua conta/i)).toBeVisible();

    await page.getByRole("button", { name: "Serviços" }).click();
    await page.getByRole("searchbox").fill("diarista");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/entrar\?destino=/);
    const destino = new URL(page.url()).searchParams.get("destino");
    expect(destino).toBe("/servicos?q=diarista");
  });
});
