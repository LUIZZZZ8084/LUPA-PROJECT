import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
  aguardarHidratacao,
} from "./helpers";

/**
 * Anotações e entrevista marcada na ficha (#539), do painel da empresa.
 *
 * Usa `app-3`, a candidatura de exemplo que já está em entrevista: marcar a
 * entrevista leva ao estágio de entrevista, e numa candidatura nova isso
 * mudaria o funil que os outros specs leem no mesmo servidor.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

/** Amanhã, às 14:30, como o `datetime-local` escreve. */
function amanha(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dia = d.toISOString().slice(0, 10);
  return `${dia}T14:30`;
}

test("anota, marca a entrevista e manda o convite pronto", async ({ page }) => {
  await page.goto("/empresa/candidaturas/app-3");
  await aguardarHidratacao(page, "form");

  await expect(
    page.getByRole("heading", { name: "Anotações e entrevista" }),
  ).toBeVisible();
  await expect(page.getByText(/Só você vê isto/).first()).toBeVisible();

  await page
    .getByLabel("Anotações")
    .fill("Boa conversa por telefone. Pede R$ 2.500.");
  await page.getByLabel("Entrevista", { exact: true }).fill(amanha());
  await page.getByLabel("Local da entrevista").fill("Av. das Itaúbas, 1200");
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByRole("status")).toContainText("Salvo");
  await expect(
    page.getByText(/^Entrevista \S+, \d{2}\/\d{2} às 14:30$/),
  ).toBeVisible();

  // O convite sai com o dia, a hora e o local, e pede confirmação.
  const convite = page.getByRole("link", {
    name: "Enviar convite no WhatsApp",
  });
  await expect(convite).toBeVisible();
  const texto = decodeURIComponent(
    ((await convite.getAttribute("href")) ?? "").split("text=")[1] ?? "",
  );
  expect(texto).toContain("entrevista");
  expect(texto).toContain("às 14:30");
  expect(texto).toContain("Av. das Itaúbas, 1200");
  expect(texto).toContain("Pode confirmar?");

  // A anotação continua lá depois de recarregar.
  await page.reload();
  await expect(page.getByLabel("Anotações")).toHaveValue(
    "Boa conversa por telefone. Pede R$ 2.500.",
  );

  await aguardarAnimacoes(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  // O painel lista a entrevista, e o card do funil também.
  await page.goto("/empresa");
  const proximas = page
    .locator("section, div")
    .filter({
      has: page.getByRole("heading", { name: "Próximas entrevistas" }),
    })
    .last();
  await expect(proximas.getByRole("link").first()).toContainText("às 14:30");

  await page.goto("/empresa/funil?estagio=entrevista");
  await expect(
    page.getByText(/Entrevista \S+, \d{2}\/\d{2} às 14:30/).first(),
  ).toBeVisible();
});

/**
 * As etiquetas (#545): escritas na ficha, aparecem no card do funil e
 * filtram a aba Talentos.
 *
 * Em `app-2`, e não na `app-3` do teste de cima: os dois salvam o formulário
 * inteiro, e rodam ao mesmo tempo — o de cima, sem etiquetas, apagava as
 * deste no meio do caminho.
 */
test("etiqueta na ficha, aparece no funil e filtra Talentos", async ({
  page,
}) => {
  await page.goto("/empresa/candidaturas/app-2");
  await aguardarHidratacao(page, "form");
  await page
    .getByLabel("Etiquetas")
    .fill("Banco de talentos, chamar na próxima");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("status")).toContainText("Salvo");

  await page.reload();
  await expect(page.getByLabel("Etiquetas")).toHaveValue(
    "banco de talentos, chamar na próxima",
  );

  await page.goto("/empresa/funil?estagio=visualizada");
  await expect(
    page.getByRole("list", { name: "Etiquetas" }).first(),
  ).toContainText("banco de talentos");

  await page.goto("/empresa/talentos?etiqueta=chamar%20na%20pr%C3%B3xima");
  const linhas = page.locator('a[href*="/empresa/candidaturas/"]');
  await expect(linhas).toHaveCount(1);
  await expect(linhas.first()).toContainText("chamar na próxima");

  await aguardarAnimacoes(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
