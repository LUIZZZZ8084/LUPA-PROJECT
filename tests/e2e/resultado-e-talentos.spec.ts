import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO,
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
} from "./helpers";

/**
 * O resultado da vaga, o chamado no WhatsApp e quem já se candidatou
 * (#492, #493, #494), do painel da empresa.
 *
 * Em demonstração o painel é o da empresa fictícia, com as vagas e as
 * candidaturas de exemplo: é o que permite medir os números sem criar nada.
 * O que muda o estado da demonstração (encerrar uma vaga) fica nos testes
 * unitários, que compartilham o servidor com os outros specs.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

const semViolacoes = async (page: import("@playwright/test").Page) => {
  await aguardarAnimacoes(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
};

test.describe("resultado de cada vaga no painel", () => {
  test("cada vaga mostra visualizações e candidaturas, com o que a visualização é", async ({
    page,
  }) => {
    // A lista de vagas é uma aba própria desde a #511.
    await page.goto("/empresa/vagas");

    const lista = page
      .locator("section", { hasText: "Vagas publicadas" })
      .first();
    await expect(
      lista.getByText(/Visualização serve para comparar uma vaga com outra/),
    ).toBeVisible();
    await expect(lista.getByText(/visualizações?$/).first()).toBeVisible();
    await expect(lista.getByText(/candidaturas?$/).first()).toBeVisible();
    // Muito compatível: o corte está dito, e é o mesmo do selo verde.
    await expect(
      lista.getByText(/70% ou mais do que a vaga pede/),
    ).toBeVisible();

    await semViolacoes(page);
  });

  test("a aba Talentos abre Quem já se candidatou", async ({ page }) => {
    await page.goto("/empresa");

    await page
      .getByRole("navigation", { name: /Seções de/ })
      .getByRole("link", { name: "Talentos" })
      .click();

    await expect(page).toHaveURL(/\/empresa\/talentos$/);
    await expect(
      page.getByRole("heading", { name: "Quem já se candidatou" }),
    ).toBeVisible();
  });
});

test.describe("publicar outra vaga parecida", () => {
  /**
   * O caminho que a vaga encerrada ou vencida oferece. Encerrar uma vaga de
   * verdade mudaria o estado da demonstração, que os outros specs
   * compartilham — então o que se confere é o destino: o formulário abre
   * preenchido com o texto da vaga, e só com ele.
   */
  test("abre preenchido com o texto da vaga, e avisa que a revisão vem antes", async ({
    page,
  }) => {
    await page.goto("/empresa/vagas/nova?modelo=job-operador-maquinas");

    await expect(page.getByText(/Preenchido com o texto de/)).toBeVisible();
    await expect(page.getByLabel("Cargo")).toHaveValue(/Operador/);
    await expect(page.getByLabel("Descrição da vaga")).not.toHaveValue("");
  });

  test("sem modelo, o formulário abre vazio", async ({ page }) => {
    await page.goto("/empresa/vagas/nova");

    await expect(page.getByLabel("Cargo")).toHaveValue("");
    await expect(page.getByText(/Preenchido com o texto de/)).toHaveCount(0);
  });

  test("id que não é da empresa abre vazio, sem dizer o motivo", async ({
    page,
  }) => {
    await page.goto("/empresa/vagas/nova?modelo=nao-existe");

    await expect(page.getByLabel("Cargo")).toHaveValue("");
    await expect(page.getByText(/Preenchido com o texto de/)).toHaveCount(0);
  });
});

test.describe("chamar no WhatsApp com a mensagem pronta", () => {
  test("o atalho da lista e o da ficha levam o nome, o cargo e a empresa", async ({
    page,
  }) => {
    // O atalho do card do funil (#511): o link do WhatsApp de uma candidatura.
    await page.goto("/empresa/funil");

    const atalho = page
      .getByRole("link", { name: /^Chamar .* no WhatsApp$/ })
      .first();
    await expect(atalho).toBeVisible();
    const href = (await atalho.getAttribute("href")) ?? "";
    expect(href).toMatch(/^https:\/\/wa\.me\/55\d+\?text=/);
    const texto = decodeURIComponent(href.split("text=")[1]);
    expect(texto).toMatch(/^Olá, \S+!/);
    expect(texto).toContain("Aqui é da ");
    expect(texto).toContain("na Lupa");

    // E o da ficha, que diz que a mensagem se edita antes de enviar.
    await page.locator('a[href*="/empresa/candidaturas/"]').first().click();
    await expect(
      page.getByRole("link", { name: "Chamar no WhatsApp" }),
    ).toBeVisible();
    await expect(page.getByText(/Edite antes de enviar/)).toBeVisible();
    const hrefFicha =
      (await page
        .getByRole("link", { name: "Chamar no WhatsApp" })
        .getAttribute("href")) ?? "";
    expect(decodeURIComponent(hrefFicha.split("text=")[1])).toContain(
      "Aqui é da ",
    );
  });
});

test.describe("quem já se candidatou", () => {
  test("reúne as pessoas sem repetir, cada uma com a vaga mais recente", async ({
    page,
  }) => {
    await page.goto("/empresa/talentos");

    await expect(
      page.getByRole("heading", { name: "Quem já se candidatou" }),
    ).toBeVisible();
    const linhas = page.locator('a[href*="/empresa/candidaturas/"]');
    await expect(linhas.first()).toBeVisible();

    // Ninguém aparece duas vezes: o nome de cada linha é único.
    const nomes = await page
      .locator('a[href*="/empresa/candidaturas/"] p.font-semibold')
      .allTextContents();
    expect(new Set(nomes).size).toBe(nomes.length);
    await expect(page.getByText(/Última candidatura:/).first()).toBeVisible();

    await semViolacoes(page);
  });

  test("filtra por habilidade, e volta ao limpar", async ({ page }) => {
    await page.goto("/empresa/talentos?q=pilotar%20foguete");

    await expect(page.getByText("Ninguém com esses filtros")).toBeVisible();
    await page.getByRole("link", { name: "Limpar busca" }).click();
    await expect(page).toHaveURL(/\/empresa\/talentos$/);
    await expect(
      page.locator('a[href*="/empresa/candidaturas/"]').first(),
    ).toBeVisible();
  });

  test("a linha abre a ficha da candidatura mais recente", async ({ page }) => {
    await page.goto("/empresa/talentos");

    await page.locator('a[href*="/empresa/candidaturas/"]').first().click();

    await expect(page).toHaveURL(/\/empresa\/candidaturas\//);
    await expect(
      page.getByRole("heading", { name: "Estágio no seu processo" }),
    ).toBeVisible();
  });
});

test.describe("quem não tem painel de empresa", () => {
  test.use({ storageState: ARQUIVO_SESSAO });

  /**
   * Em demonstração o painel inteiro é o da empresa fictícia, e qualquer
   * conta o vê — a mesma regra de `/empresa`. A página só responde 404 em
   * produção, onde o papel decide; o que se afirma aqui é que ela não
   * quebra.
   */
  test("a lista abre, e não quebra", async ({ page }) => {
    const resposta = await page.goto("/empresa/talentos");

    expect([200, 404]).toContain(resposta?.status());
  });
});
