import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * Cada vaga tem a página do seu processo seletivo (#612).
 *
 * O que só o navegador prova: a aba Vagas leva até ela, a página mostra o
 * estado, a contagem por etapa e o quadro só daquela vaga, a busca filtra,
 * e quem não é dono recebe 404.
 *
 * A vaga é a de exemplo da demonstração, que é da empresa da sessão. Nada
 * aqui move candidato de etapa: o estado da demonstração é compartilhado
 * com os outros specs.
 *
 * **Quem não é dono não se prova aqui.** Em demonstração toda conta vê o
 * painel da empresa fictícia, de propósito (`temPainelDeEmpresa`), então um
 * candidato abriria esta página. O portão é o mesmo da aba Candidatos, e a
 * posse da vaga é conferida em `processo-da-vaga.test.tsx`.
 */
const PROCESSO = "/empresa/vagas/job-operador-maquinas";

test.describe("processo seletivo da vaga", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("a aba Vagas leva ao processo de cada vaga", async ({ page }) => {
    await page.goto("/empresa/vagas");
    const link = page
      .locator(`a[href="${PROCESSO}"]`)
      .filter({ hasText: "Ver processo seletivo" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${PROCESSO}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Operador",
    );
  });

  test("mostra o estado, a contagem por etapa, as ações e o quadro só dela", async ({
    page,
  }) => {
    await page.goto(PROCESSO);

    await expect(page.getByText("Ativa", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Publicada em \d{2}\/\d{2}\/\d{4}/),
    ).toBeVisible();
    const etapas = page.getByRole("list", { name: "Candidatos por etapa" });
    await expect(etapas.getByRole("listitem")).toHaveCount(7);
    await expect(etapas).toContainText("Contatado");
    await expect(etapas).toContainText("Contratado");

    await expect(
      page.getByRole("link", { name: "Ver anúncio" }),
    ).toHaveAttribute("href", "/vagas/job-operador-maquinas");
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();

    // Quadro de uma vaga só: sem o seletor de vaga.
    await expect(page.getByLabel("Vaga", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Buscar candidato pelo nome")).toBeVisible();
  });

  test("a busca por nome filtra os cards", async ({ page }) => {
    await page.goto(PROCESSO);
    const fichas = page.locator('main a[href^="/empresa/candidaturas/"]');
    const antes = await fichas.count();
    expect(antes).toBeGreaterThan(0);

    await page.getByLabel("Buscar candidato pelo nome").fill("zzzzz");
    await expect(page.getByText(/Ninguém com esse nome/)).toBeVisible();
    await expect(fichas).toHaveCount(0);

    await page.getByLabel("Buscar candidato pelo nome").fill("");
    await expect(fichas).toHaveCount(antes);
  });

  test("passa no axe", async ({ page }) => {
    await page.goto(PROCESSO);
    await expect(page.getByLabel("Buscar candidato pelo nome")).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test("vaga que não é da empresa responde 404", async ({ page }) => {
    const resposta = await page.goto("/empresa/vagas/vaga-que-nao-existe");
    expect(resposta?.status()).toBe(404);
  });
});
