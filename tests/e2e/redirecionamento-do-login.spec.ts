import { expect, type Page, test } from "@playwright/test";
import { emailDaConta, SENHA_DE_TESTE } from "./helpers";

/**
 * O `?destino=` do login só pode levar de volta para dentro da Lupa (#345).
 *
 * O unitário de `destinoSeguro` prova a função pura; aqui a prova é a do
 * navegador de verdade, pelo caminho que a pessoa percorre — porque quem
 * resolve `/\evil.com` em `https://evil.com` é o parser de URL do navegador,
 * e é o `router.replace`, no cliente, que decide para onde ir depois do login.
 *
 * **Loga na conta compartilhada do setup, não cria conta.** Um
 * `entrarComoTeste` por teste cadastra, e o teto de `cadastro:<origem>` é
 * compartilhado por toda a suíte — em dois projetos e com retries, cadastrar
 * aqui estoura o limite e derruba até testes vizinhos (o `virar-prestador`, que
 * também cadastra). É a lição que o AGENTS.md registra: a suíte compartilha
 * login justamente para não refazer cadastro. Login é por e-mail e não gasta
 * esse teto.
 */
test.describe("redirecionamento pós-login", () => {
  // Sem sessão: o teste precisa exercitar o login em si, com destino na URL.
  test.use({ storageState: { cookies: [], origins: [] } });

  async function logarComDestino(page: Page, destino: string): Promise<void> {
    await page.goto(`/entrar?destino=${encodeURIComponent(destino)}`);
    await page.getByLabel("E-mail").fill(emailDaConta("candidato"));
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }

  test("destino forjado com barra invertida não leva para fora do app", async ({
    page,
    baseURL,
  }) => {
    // `/\evil.com`: passa numa checagem ingênua de prefixo, e o navegador o
    // resolve para https://evil.com. É o trampolim que a correção fecha.
    await logarComDestino(page, "/\\evil.com");

    // A navegação pós-login acontece (sai de /entrar)…
    await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));

    // …e continua na origem do app, nunca em evil.com. O destino forjado foi
    // descartado, então cai no destino padrão do papel (a home).
    expect(new URL(page.url()).origin).toBe(new URL(String(baseURL)).origin);
    expect(page.url()).not.toContain("evil.com");
  });

  test("destino interno legítimo é respeitado", async ({ page }) => {
    await logarComDestino(page, "/perfil/editar");

    await page.waitForURL(/\/perfil\/editar/);
    expect(new URL(page.url()).pathname).toBe("/perfil/editar");
  });
});
