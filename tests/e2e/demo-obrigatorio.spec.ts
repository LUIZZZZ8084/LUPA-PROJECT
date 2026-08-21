import { expect, test } from "@playwright/test";

/**
 * A suíte só pode rodar em modo demonstração.
 *
 * `npm start` carrega o `.env.local`. Quem tiver credenciais reais ali —
 * quem administra o projeto, tipicamente — passa a rodar o e2e contra o
 * banco de produção sem nenhum aviso.
 *
 * Não é hipótese: o ajudante de login criou 213 contas na base real antes
 * de alguém notar, e só se notou porque as asserções começaram a falhar
 * por estarem medindo dados de verdade em vez dos de exemplo.
 *
 * Este teste roda antes dos outros por ordem alfabética do arquivo e falha
 * barulhento. Um teste que grava em produção é pior do que um teste que
 * não roda.
 */
test("a suíte não está apontada para um banco de verdade", async ({ page }) => {
  await page.goto("/vagas");

  await expect(
    page.getByText(/não são ofertas reais/),
    "o aviso de demonstração sumiu: a suíte está falando com um banco real",
  ).toBeVisible();
});
