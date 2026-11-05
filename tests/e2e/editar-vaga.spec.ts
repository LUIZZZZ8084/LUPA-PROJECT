import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
  aguardarHidratacao,
  confirmarPublicacao,
  escolherCidade,
} from "./helpers";

/**
 * Editar a vaga publicada (#544), do card da aba Vagas até a vaga no ar.
 *
 * Publica a própria vaga antes: editar as de exemplo mudaria o texto que os
 * outros specs leem no mesmo servidor.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

test("corrige a descrição pela aba Vagas, e o cargo continua travado", async ({
  page,
}) => {
  const cargo = `Motorista para Editar ${Date.now()}`;

  await page.goto("/empresa/vagas/nova");
  await aguardarHidratacao(page, "form");
  await page.getByLabel("Cargo").fill(cargo);
  await page.getByLabel("Categoria").selectOption("Logística e Transporte");
  await page.getByLabel("Tipo de contrato").selectOption("CLT");
  await page.getByLabel("Presencial").check();
  await page.getByLabel("Não é para PCD").check();
  await escolherCidade(page, "Sorriso - MT", "Cidade da vaga");
  await page.getByLabel("Endereço").fill("Rua de teste, 100");
  await page
    .getByLabel("Descrição da vaga")
    .fill("Vaga de teste para conferir a edição, com o texto de antes.");
  await confirmarPublicacao(page);
  await expect(
    page.getByRole("heading", { name: "Vaga publicada" }),
  ).toBeVisible({ timeout: 20_000 });

  // O card da vaga na aba Vagas leva à edição.
  await page.goto("/empresa/vagas");
  await page.getByRole("link", { name: `Editar a vaga ${cargo}` }).click();
  await page.waitForURL(/\/empresa\/vagas\/[^/]+\/editar$/);
  await aguardarHidratacao(page, "form");

  // O que não muda aparece, e não é campo.
  await expect(page.getByText("O que não muda")).toBeVisible();
  await expect(page.getByText(cargo).first()).toBeVisible();
  await expect(page.getByLabel("Cargo")).toHaveCount(0);

  await aguardarAnimacoes(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page
    .getByLabel("Descrição da vaga")
    .fill("Vaga de teste para conferir a edição, agora com o texto corrigido.");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("status")).toContainText("Vaga atualizada");

  // A vaga no ar mostra o texto novo, com o mesmo cargo.
  await page.getByRole("link", { name: "Ver como ficou" }).click();
  await page.waitForURL(/\/vagas\/[^/]+$/);
  await expect(page.getByRole("heading", { name: cargo })).toBeVisible();
  await expect(page.getByText(/agora com o texto corrigido/)).toBeVisible();
});

test("vaga de outra empresa responde 404", async ({ page }) => {
  const resposta = await page.goto("/empresa/vagas/nao-existe/editar");
  expect(resposta?.status()).toBe(404);
});
