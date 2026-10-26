import { expect, test } from "@playwright/test";
import { aguardarHidratacao } from "./helpers";

/**
 * A busca do hero e a troca entre Vagas e Serviços (#341).
 *
 * O que só o navegador responde: o formulário do hero chega à lista com os
 * filtros preenchidos, o visitante cai no login com a busca guardada, e o
 * alternador do topo das listas leva o termo de uma lista para a outra.
 */
/*
 * Todo teste que clica ou escolhe algo no hero espera a hidratação antes (#483).
 *
 * O alternador Vagas/Serviços e o estado da busca vivem no React. O clique que
 * chega antes de o React assumir se perde, e a busca sai para `/vagas` em vez de
 * `/servicos`: era o que fazia estes testes falharem às vezes no celular, em
 * desenvolvimento (onde a hidratação demora), inclusive na `main`. É o mesmo
 * cuidado que `escolherCidade` e `aguardarHidratacao` já têm em `helpers.ts`.
 */
test.describe("busca no hero, com sessão", () => {
  test("a busca de vagas chega à lista com o termo", async ({ page }) => {
    await page.goto("/");
    await aguardarHidratacao(page, 'select[name="uf"]');

    await page.getByRole("searchbox").fill("auxiliar");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/vagas\?q=auxiliar$/);
    await expect(page.getByRole("searchbox")).toHaveValue("auxiliar");
  });

  test("Serviços no hero leva a busca para /servicos", async ({ page }) => {
    await page.goto("/");
    await aguardarHidratacao(page, 'select[name="uf"]');

    await page.getByRole("button", { name: "Serviços" }).click();
    await page.getByRole("searchbox").fill("diarista");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/servicos\?q=diarista$/);
  });

  /**
   * O banner da home (#372): o `<h1>` agora é visível, com o convite novo.
   * O título "O que você está procurando aqui perto?" e os atalhos de
   * categoria (#364) continuam fora.
   */
  test("o banner tem o h1 visível, sem o título antigo nem os atalhos", async ({
    page,
  }) => {
    await page.goto("/");
    await aguardarHidratacao(page, 'select[name="uf"]');

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Encontre seu próximo trabalho");
    await expect(h1).toBeVisible();

    await expect(page.getByText("O que você está procurando")).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Mais procurados" }),
    ).toHaveCount(0);
  });

  test("a faixa de números leva às listas", async ({ page }) => {
    await page.goto("/");
    await aguardarHidratacao(page, 'select[name="uf"]');

    await expect(
      page.getByRole("link", { name: /vagas abertas/i }),
    ).toHaveAttribute("href", "/vagas");
    await expect(
      page.getByRole("link", { name: /profissionais$/i }),
    ).toHaveAttribute("href", "/servicos");
  });

  test("os profissionais são links para o perfil, sem contato na home", async ({
    page,
  }) => {
    await page.goto("/");
    await aguardarHidratacao(page, 'select[name="uf"]');

    const perfis = page.locator('a[href^="/servicos/"]');
    expect(await perfis.count()).toBeGreaterThan(0);

    const html = await page.content();
    expect(html).not.toContain("wa.me");
  });
});

test.describe("alternador nas listas", () => {
  test("leva o termo de vagas para serviços e de volta", async ({ page }) => {
    await page.goto("/vagas?q=limpeza");
    await aguardarHidratacao(page, "form");

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
    await aguardarHidratacao(page, "form");

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
    await aguardarHidratacao(page, 'select[name="uf"]');
    await expect(page.getByText(/entre ou crie sua conta/i)).toBeVisible();

    await page.getByRole("button", { name: "Serviços" }).click();
    await page.getByRole("searchbox").fill("diarista");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/entrar\?destino=/);
    const destino = new URL(page.url()).searchParams.get("destino");
    expect(destino).toBe("/servicos?q=diarista");
  });
});
