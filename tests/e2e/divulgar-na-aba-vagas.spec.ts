import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * Divulgar a vaga direto da aba Vagas (#567).
 *
 * O painel de divulgação (#490) mora na página da vaga, e a empresa
 * precisava abrir cada uma para mandar no WhatsApp. O atalho fica na linha
 * de cada vaga ativa — e só nelas: vaga encerrada ou vencida não recebe
 * candidatura, e divulgá-la mandaria gente para um beco.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

test("cada vaga ativa tem o atalho do WhatsApp, e abre com o link dela", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const abertos: string[] = [];
    (window as unknown as { abertos: string[] }).abertos = abertos;
    window.open = (url) => {
      abertos.push(String(url));
      return null;
    };
  });
  await page.goto("/empresa/vagas");

  const linhas = page.getByRole("listitem").filter({
    has: page.getByText("Ativa", { exact: true }),
  });
  const ativas = await linhas.count();
  expect(ativas).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /no WhatsApp$/ })).toHaveCount(
    ativas,
  );

  const linha = linhas.first();
  const href = await linha.getByRole("link").first().getAttribute("href");
  await linha.getByRole("button", { name: /no WhatsApp$/ }).click();

  const abertos = await page.evaluate(
    () => (window as unknown as { abertos: string[] }).abertos,
  );
  expect(abertos).toHaveLength(1);
  expect(decodeURIComponent(abertos[0])).toContain(
    `${new URL(page.url()).origin}${href}`,
  );
});
