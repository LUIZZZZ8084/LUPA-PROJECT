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

  /**
   * O hero perdeu o título grande e os atalhos (#364), mas a home não pode
   * ficar sem `<h1>`: leitor de tela e buscador dependem dele.
   */
  test("sem título grande nem atalhos, e com h1 para leitor de tela", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("O que você está procurando")).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Mais procurados" }),
    ).toHaveCount(0);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Trabalho e profissionais perto de você");

    // `sr-only` reduz a caixa a 1 px: está no HTML e na árvore de
    // acessibilidade, e não ocupa lugar na tela.
    const caixa = await h1.boundingBox();
    expect(caixa?.width).toBeLessThanOrEqual(1);
    expect(caixa?.height).toBeLessThanOrEqual(1);
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
