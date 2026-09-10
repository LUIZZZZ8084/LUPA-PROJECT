import { expect, test } from "@playwright/test";

/**
 * "Esqueci minha senha", no navegador (#174).
 *
 * A suíte roda em demonstração e **sem provedor de e-mail configurado** —
 * é o estado em que o app fica até alguém criar a conta no Resend. Então
 * o que dá para provar aqui é a metade que não depende de credencial, e
 * ela é a que mais importa para quem chega perdido na tela de login:
 *
 * - o caminho existe e é alcançável **sem sessão**;
 * - a tela não mente quando o envio não está disponível;
 * - o link com token incompleto explica em vez de dar erro.
 *
 * O miolo — token gerado, gasto uma vez, senha trocada — é exercitado em
 * `recuperacao-de-senha.test.ts`, com o e-mail injetado. Um e2e que
 * dependesse de caixa de entrada de verdade seria um teste que falha
 * vermelho por causa de terceiro fora do ar, que é o que este projeto
 * evita em toda parte.
 */
test.describe("esqueci minha senha", () => {
  // Sem sessão: quem esqueceu a senha não está logado, por definição.
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * O muro de login não pode fechar a porta de quem perdeu a chave.
   *
   * `/esqueci-senha` e `/redefinir-senha` entraram em `ABERTAS` no
   * `src/proxy.ts` por isso — e é o tipo de coisa que, esquecida, faz a
   * tela existir e ninguém alcançar.
   */
  test("a tela abre sem sessão", async ({ page }) => {
    const resposta = await page.goto("/esqueci-senha");

    expect(resposta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /esqueci minha senha/i }),
    ).toBeVisible();
  });

  test("o login oferece o caminho", async ({ page }) => {
    await page.goto("/entrar");

    const link = page.getByRole("link", { name: /esqueci minha senha/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/esqueci-senha");
  });

  /**
   * Sem provedor configurado, o recurso não existe — e a tela diz isso.
   *
   * É a mesma degradação do Storage sem Supabase e do push sem VAPID.
   * Fingir que enviou deixaria a pessoa esperando um e-mail que nunca
   * sai, e concluindo que a conta sumiu.
   */
  test("sem provedor de e-mail, avisa em vez de fingir que enviou", async ({
    page,
  }) => {
    await page.goto("/esqueci-senha");
    await page.getByLabel("E-mail").fill("alguem@teste.lupa");
    await page.getByRole("button", { name: /enviar o link/i }).click();

    await expect(page.getByText(/não está disponível/i)).toBeVisible({
      timeout: 15_000,
    });
    // E não mostra a confirmação, que seria a mentira.
    await expect(
      page.getByRole("heading", { name: /confira o seu e-mail/i }),
    ).toHaveCount(0);
  });

  /**
   * Quem abre `/redefinir-senha` na mão, ou com o link cortado pelo
   * cliente de e-mail, precisa de uma saída — não de um erro.
   */
  test("link sem token explica e oferece pedir outro", async ({ page }) => {
    const resposta = await page.goto("/redefinir-senha");

    expect(resposta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /link incompleto/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /pedir um link novo/i }),
    ).toHaveAttribute("href", "/esqueci-senha");
  });

  /**
   * Token inventado é recusado, e a mensagem não confirma se ele já
   * existiu — a mesma regra de "não encontrado em vez de sem permissão"
   * que o resto do app usa contra quem sonda.
   */
  test("token inventado não troca senha nenhuma", async ({ page }) => {
    await page.goto("/redefinir-senha?token=nao-existe-isso-aqui");
    await page.getByLabel("Nova senha").fill("senhaNova123");
    await page.getByRole("button", { name: /salvar e entrar/i }).click();

    await expect(page.getByText(/não vale mais|inválido/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
