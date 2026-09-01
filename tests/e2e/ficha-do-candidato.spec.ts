import { expect, test } from "@playwright/test";

/**
 * A ficha do candidato, no navegador.
 *
 * O que se confere aqui é o caminho que a empresa percorre: recebeu o
 * currículo, abriu a pessoa, chamou. Antes disto a lista era um beco — nome,
 * bairro, vaga, e nenhum lugar para clicar.
 */
test.describe("ficha do candidato", () => {
  test("a linha da lista abre a pessoa", async ({ page }) => {
    await page.goto("/empresa");

    const primeira = page.locator('a[href^="/empresa/candidaturas/"]').first();
    await expect(primeira).toBeVisible();

    // O nome, e não o texto inteiro da linha: ali dentro também estão as
    // iniciais do avatar, o título da vaga e o tempo.
    const nome = (await primeira.locator("p").first().textContent())?.trim();
    expect(nome).toBeTruthy();

    await primeira.click();

    await expect(page).toHaveURL(/\/empresa\/candidaturas\//);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      nome as string,
    );
  });

  test("o contato está na ficha, e o WhatsApp já vai com recado", async ({
    page,
  }) => {
    await page.goto("/empresa");
    await page.locator('a[href^="/empresa/candidaturas/"]').first().click();

    const whats = page.getByRole("link", { name: /falar no whatsapp/i });
    await expect(whats).toBeVisible();

    /*
     * A mensagem pronta não é enfeite: sem ela a empresa abre o WhatsApp
     * numa conversa em branco e precisa lembrar de qual vaga se trata,
     * com o candidato do outro lado recebendo "oi" de um número
     * desconhecido.
     */
    const href = await whats.getAttribute("href");
    expect(href).toContain("wa.me/55");
    expect(decodeURIComponent(href ?? "")).toContain("candidatura");

    await expect(
      page.getByRole("link", { name: /enviar e-mail/i }),
    ).toHaveAttribute("href", /^mailto:/);
  });

  test("mostra o currículo, ou diz que não tem", async ({ page }) => {
    await page.goto("/empresa");
    await page.locator('a[href^="/empresa/candidaturas/"]').first().click();

    await expect(
      page.getByRole("heading", { name: "Currículo em PDF" }),
    ).toBeVisible();

    const temLink = await page
      .getByRole("link", { name: /abrir currículo/i })
      .count();
    if (temLink === 0) {
      await expect(page.getByText(/ainda não enviou currículo/i)).toBeVisible();
    }
  });

  /**
   * Candidatura de outra empresa, ou que não existe, responde 404 — nunca
   * 403. Um 403 confirma que o registro existe, e o que existe aqui é o
   * telefone de alguém procurando emprego.
   */
  test("id que não é seu responde 404, não 403", async ({ page }) => {
    const resposta = await page.goto(
      "/empresa/candidaturas/00000000-0000-4000-8000-000000000000",
    );
    expect(resposta?.status()).toBe(404);
  });

  test("o selo do topo mostra o estágio, não um texto genérico", async ({
    page,
  }) => {
    await page.goto("/empresa");
    await page.locator('a[href^="/empresa/candidaturas/"]').first().click();

    const selo = page
      .locator("main")
      .getByText(/^(Nova|Em triagem|Entrevista|Selecionado|Reprovado)$/);
    await expect(selo.first()).toBeVisible();
  });

  /**
   * "Enviada" era o rótulo de toda candidatura da lista — descrevia o
   * óbvio, do ponto de vista errado. O que a empresa precisa saber é o que
   * ainda não olhou.
   */
  test('o estágio inicial se chama "Nova", não "Enviada"', async ({ page }) => {
    await page.goto("/empresa");

    const seletores = page.getByLabel("Estágio da candidatura");
    await expect(seletores.first()).toBeVisible();

    const opcoes = await seletores.first().locator("option").allTextContents();

    expect(opcoes).toContain("Nova");
    expect(opcoes).not.toContain("Enviada");
  });
});
