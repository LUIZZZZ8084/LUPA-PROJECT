import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cpfDeTeste, escolherCidade, SENHA_DE_TESTE } from "./helpers";

/**
 * "Quero que empresas me encontrem", escolhido no cadastro (#622, #627).
 *
 * O que só o navegador prova: a escolha aparece no cadastro de candidato,
 * com "Sim" e "Não" e nenhum dos dois marcado; o cadastro não sai sem
 * resposta; quem escolhe "Sim" nasce visível, e a caixa de Editar perfil
 * vem ligada.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("a escolha aparece sem nada marcado, é obrigatória, e o Sim vale", async ({
  page,
}) => {
  await page.goto("/cadastro?tipo=candidato_clt");

  const grupo = page.getByRole("group", {
    name: "Quer que empresas encontrem você?",
  });
  const sim = grupo.getByLabel(/Sim, quero que empresas me encontrem/);
  const nao = grupo.getByLabel(/Não, só pelas vagas/);
  await expect(grupo).toBeVisible();
  await expect(sim).not.toBeChecked();
  await expect(nao).not.toBeChecked();
  await expect(grupo).toContainText("WhatsApp");
  await expect(grupo).toContainText("Editar perfil");

  const { violations } = await new AxeBuilder({ page })
    .include("form")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  const email = `visivel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@teste.lupa`;
  await page.getByLabel("Nome completo").fill("Pessoa Visível");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("WhatsApp").fill("66999999999");
  await page.getByLabel("CPF").fill(cpfDeTeste());
  await page.getByLabel("Área desejada").selectOption({ index: 1 });
  await escolherCidade(page);
  await page.getByLabel("Senha").fill(SENHA_DE_TESTE);

  // Sem responder, o navegador segura o envio e aponta a pergunta.
  await page.getByRole("button", { name: /criar conta/i }).click();
  expect(
    await sim.evaluate((el: HTMLInputElement) => el.validity.valueMissing),
  ).toBe(true);
  await expect(page).toHaveURL(/\/cadastro/);

  await sim.check();
  await page.getByRole("button", { name: /criar conta/i }).click();
  await page.getByText(/Conta criada/i).waitFor({ timeout: 15_000 });

  await page.goto("/perfil/editar");
  await expect(
    page.getByLabel(/quero que empresas me encontrem/i),
  ).toBeChecked();
});
