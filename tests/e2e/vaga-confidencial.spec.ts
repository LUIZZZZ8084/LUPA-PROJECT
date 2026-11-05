import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
  aguardarHidratacao,
  escolherCidade,
} from "./helpers";

/**
 * A vaga de agência, da publicação ao que o candidato vê (#538).
 *
 * A agência descreve o cliente sem o nome; a revisão mostra a descrição, e a
 * vaga publicada aparece como confidencial, "via" a conta que publicou — no
 * detalhe aberto sem login e no card da busca.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

const CLIENTE = "Indústria de alimentos de grande porte";

test("a agência publica para um cliente, e a vaga diz só o que deve", async ({
  page,
  browser,
}) => {
  const cargo = `Auxiliar de Produção Confidencial ${Date.now()}`;

  await page.goto("/empresa/vagas/nova");
  await aguardarHidratacao(page, "form");
  await page.getByLabel("Cargo").fill(cargo);
  await page.getByLabel("Categoria").selectOption("Logística e Transporte");
  await page.getByLabel("Tipo de contrato").selectOption("CLT");
  await page.getByLabel("Presencial").check();
  await page.getByLabel("Não é para PCD").check();
  await page.getByLabel(/Vaga para um cliente seu/).fill(CLIENTE);
  await escolherCidade(page, "Sorriso - MT", "Cidade da vaga");
  await page.getByLabel("Endereço").fill("Rua de teste, 100");
  await page
    .getByLabel("Descrição da vaga")
    .fill(
      "Vaga de teste automatizado para conferir a vaga confidencial, da " +
        "publicação ao que o candidato vê.",
    );

  await page
    .getByRole("button", { name: /revisar antes de publicar/i })
    .click();
  const revisao = page.getByRole("region", { name: "Revisão da vaga" });
  await expect(revisao.getByText(new RegExp(CLIENTE))).toBeVisible();

  await page.getByRole("button", { name: /confirmar e publicar/i }).click();
  await expect(
    page.getByRole("heading", { name: "Vaga publicada" }),
  ).toBeVisible({ timeout: 20_000 });

  // O card da busca diz o cliente, via quem publicou.
  await page.goto(`/vagas?q=${encodeURIComponent(cargo)}`);
  const card = page.getByRole("link", { name: new RegExp(cargo) }).first();
  await expect(card).toContainText(`${CLIENTE}, via`);

  // E o detalhe, aberto sem conta, explica o sigilo.
  await card.click();
  await page.waitForURL(/\/vagas\/[^/?]+$/);
  const anonimo = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const publica = await anonimo.newPage();
  await publica.goto(page.url());
  await expect(
    publica.getByText(`${CLIENTE}, via`, { exact: false }).first(),
  ).toBeVisible();
  await expect(
    publica.getByText(/o nome de quem contrata fica em sigilo/),
  ).toBeVisible();

  await aguardarAnimacoes(publica);
  const { violations } = await new AxeBuilder({ page: publica })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  await anonimo.close();
});
