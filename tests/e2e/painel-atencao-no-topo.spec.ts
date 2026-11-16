import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * O painel da empresa abre no que pede ação (#624).
 *
 * "Precisa da sua atenção" ficava depois do tutorial, do contador de vagas,
 * do aviso de e-mail e de seis cartões de número: fora da primeira tela no
 * computador, na segunda tela do celular. O subtítulo da página promete
 * exatamente essa lista.
 */
test.describe("painel da empresa, o que pede ação primeiro", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("as pendências vêm antes da visão geral e na primeira tela", async ({
    page,
  }) => {
    await page.goto("/empresa");

    const atencao = page.getByRole("heading", {
      name: "Precisa da sua atenção",
    });
    const visao = page.getByRole("heading", { name: "Visão geral" });
    await expect(atencao).toBeVisible();
    await expect(visao).toBeVisible();

    const a = await atencao.boundingBox();
    const v = await visao.boundingBox();
    const altura = page.viewportSize()?.height ?? 0;
    expect(a && v && a.y < v.y).toBe(true);
    expect(a && a.y < altura).toBe(true);
  });

  test("com plano ilimitado, sem o cartão de vagas para publicar", async ({
    page,
  }) => {
    // A sessão de empresa da suíte assina o ilimitado no setup.
    await page.goto("/empresa");
    await expect(page.getByText("Plano ilimitado ativo")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Vagas para publicar" }),
    ).toHaveCount(0);
  });

  test("o funil conta quem chegou a cada etapa, com rótulo no passado", async ({
    page,
  }) => {
    await page.goto("/empresa");
    const funil = page.locator('section[aria-labelledby="funil-em-numeros"]');
    await expect(funil).toBeVisible();
    await expect(funil).toContainText("Passaram pela triagem");
    await expect(funil).toContainText("Chegaram à entrevista");
    // "Em triagem" é a etapa de agora, e mora só na visão geral.
    await expect(funil.getByText("Em triagem", { exact: true })).toHaveCount(0);
  });
});
