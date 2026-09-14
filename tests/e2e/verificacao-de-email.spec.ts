import { expect, test } from "@playwright/test";

/**
 * A tela que o link de confirmação abre (#227).
 *
 * O que dá para exercitar aqui é a metade sem e-mail: a suíte roda em modo
 * demonstração, sem `RESEND_API_KEY`, então nenhum link de verdade é
 * gerado. O caminho com token válido é coberto em
 * `tests/unit/server/verificacao-de-email.test.ts`, que exercita pedir →
 * confirmar → tentar de novo, e o caso que decide a segurança — token de
 * verificação não redefine senha.
 *
 * O que estes testes protegem é o que só existe no navegador: a rota ser
 * **aberta**, e responder 200 em vez de mandar para o login.
 */
test.describe("confirmação de e-mail", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * A razão de ela ser aberta, e a única que importa: a pessoa quase sempre
   * clica no link do celular, que pode não ser o aparelho onde ela está
   * logada. Exigir sessão mandaria quem confirmou para uma tela de login —
   * e o token, que é de uso único, já teria sido gasto ou nem chegaria a
   * ser lido.
   */
  test("abre sem sessão, em vez de redirecionar para o login", async ({
    page,
  }) => {
    const resposta = await page.goto("/verificar-email?token=nao-existe");

    expect(resposta?.status()).toBe(200);
    expect(page.url()).toContain("/verificar-email");
    expect(page.url()).not.toContain("/entrar");
  });

  /**
   * Token inválido, expirado, já usado ou de outra finalidade dão a mesma
   * tela. Distinguir só informaria quem está sondando — e para quem clicou
   * os quatro significam a mesma coisa: peça outro.
   */
  test("token inválido explica o que fazer, sem detalhar o porquê", async ({
    page,
  }) => {
    await page.goto("/verificar-email?token=nao-existe");

    await expect(page.getByText("Link inválido")).toBeVisible();
    await expect(page.getByText(/vale por 24 horas/)).toBeVisible();
  });

  /** Sem token nenhum é o mesmo caso, e não uma tela quebrada. */
  test("sem token, não quebra", async ({ page }) => {
    const resposta = await page.goto("/verificar-email");
    expect(resposta?.status()).toBe(200);
    await expect(page.getByText("Link inválido")).toBeVisible();
  });
});
