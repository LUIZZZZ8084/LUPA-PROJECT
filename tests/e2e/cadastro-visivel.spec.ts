import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cpfDeTeste, escolherCidade, SENHA_DE_TESTE } from "./helpers";

/**
 * "Quero que empresas me encontrem", escolhido no cadastro (#622).
 *
 * O que só o navegador prova: a escolha aparece no cadastro de candidato,
 * com "Sim" marcado e "Não" ao lado; quem cria a conta sem mexer nela
 * nasce visível; e a caixa de Editar perfil vem ligada.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("a escolha aparece com Sim marcado, e quem não mexe nasce visível", async ({
  page,
}) => {
  await page.goto("/cadastro?tipo=candidato_clt");

  const grupo = page.getByRole("group", {
    name: "Quer que empresas encontrem você?",
  });
  await expect(grupo).toBeVisible();
  await expect(grupo.getByLabel(/Sim, quero ser encontrado/)).toBeChecked();
  await expect(grupo.getByLabel(/Não, só pelas vagas/)).not.toBeChecked();
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
  await page.getByRole("button", { name: /criar conta/i }).click();
  await page.getByText(/Conta criada/i).waitFor({ timeout: 15_000 });

  await page.goto("/perfil/editar");
  await expect(
    page.getByLabel(/quero que empresas me encontrem/i),
  ).toBeChecked();
});
