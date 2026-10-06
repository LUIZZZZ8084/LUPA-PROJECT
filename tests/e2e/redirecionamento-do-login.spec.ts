import { expect, test } from "@playwright/test";
import { entrarComoTeste, SENHA_DE_TESTE } from "./helpers";

/**
 * O `?destino=` do login só pode levar de volta para dentro da Lupa (#345).
 *
 * O unitário de `destinoSeguro` prova a função pura; aqui a prova é a do
 * navegador de verdade, pelo caminho que a pessoa percorre — porque quem
 * resolve `/\evil.com` em `https://evil.com` é o parser de URL do navegador,
 * e é o `router.replace`, no cliente, que decide para onde ir depois do login.
 * Medir no DOM o que o navegador faz com a barra invertida é o ponto.
 */
test.describe("redirecionamento pós-login", () => {
  // Sem sessão: o teste precisa exercitar o login em si, com destino na URL.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("destino forjado com barra invertida não leva para fora do app", async ({
    page,
    baseURL,
  }) => {
    // Cria a conta (termina logada) e guarda o e-mail; depois desloga para
    // poder exercitar a tela de login com o destino na query.
    const email = await entrarComoTeste(page);
    await page.context().clearCookies();

    // `/\evil.com`: passa numa checagem ingênua de prefixo, e o navegador o
    // resolve para https://evil.com. É o trampolim que a correção fecha.
    await page.goto(`/entrar?destino=${encodeURIComponent("/\\evil.com")}`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    // A navegação pós-login acontece (sai de /entrar)…
    await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));

    // …e continua na origem do app, nunca em evil.com. O destino forjado foi
    // descartado, então cai no destino padrão do papel (a home).
    expect(new URL(page.url()).origin).toBe(new URL(String(baseURL)).origin);
    expect(page.url()).not.toContain("evil.com");
  });

  test("destino interno legítimo é respeitado", async ({ page }) => {
    const email = await entrarComoTeste(page);
    await page.context().clearCookies();

    await page.goto(`/entrar?destino=${encodeURIComponent("/perfil/editar")}`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    await page.waitForURL(/\/perfil\/editar/);
    expect(new URL(page.url()).pathname).toBe("/perfil/editar");
  });
});
