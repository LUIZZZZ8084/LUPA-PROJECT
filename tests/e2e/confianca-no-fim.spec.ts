import { expect, test } from "@playwright/test";

/**
 * O bloco "O que a gente confere" é o último da home, e fala com calma (#378).
 *
 * Ele ficava logo depois das vagas, e fechava com frases de alerta para quem
 * acabou de chegar: "nada disso prova quem a pessoa é", "combine num lugar
 * movimentado", "desconfie de quem cobra taxa". Foi para o fim, e o texto
 * passou a dizer o que a Lupa faz por quem usa.
 *
 * O que ele **afirma** não mudou, e `promessas-da-tela` cobra isso: só o que
 * o app de fato confere. A home é pública, então a conferência é sem sessão.
 */
test.describe("bloco de confiança da home", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("é o último bloco, depois da chamada para empresas", async ({
    page,
  }) => {
    await page.goto("/");

    const confianca = page.getByRole("heading", {
      name: /o que a gente confere/i,
    });
    const empresas = page.getByRole("heading", {
      name: /sua empresa está contratando/i,
    });
    const vagas = page.getByRole("heading", { name: "Vagas em destaque" });

    const y = async (l: typeof confianca) =>
      (await l.boundingBox())?.y ?? Number.NaN;
    const [yVagas, yEmpresas, yConfianca] = [
      await y(vagas),
      await y(empresas),
      await y(confianca),
    ];

    expect(yVagas).toBeLessThan(yEmpresas);
    expect(yEmpresas).toBeLessThan(yConfianca);

    // E nada de conteúdo da home vem depois dele, a não ser o rodapé de direitos.
    const depois = await page.evaluate(() => {
      const h = [...document.querySelectorAll("h2")].find((e) =>
        /o que a gente confere/i.test(e.textContent ?? ""),
      );
      const painel = h?.closest("div");
      const outros = [...document.querySelectorAll("h2")].filter(
        (e) =>
          painel &&
          e !== h &&
          Boolean(
            painel.compareDocumentPosition(e) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      );
      return outros.map((e) => e.textContent);
    });
    expect(depois).toEqual([]);
  });

  test("não traz as frases de alerta", async ({ page }) => {
    await page.goto("/");

    const texto = (
      await page.locator("main, body").first().innerText()
    ).toLowerCase();
    for (const frase of [
      "nada disso prova",
      "lugar movimentado",
      "desconfie",
      "prova de quem",
    ]) {
      expect(texto, frase).not.toContain(frase);
    }
  });

  test("diz o que a Lupa confere, e só isso", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/conferimos o cnpj na receita/i)).toBeVisible();
    await expect(page.getByText(/cada cpf vale uma conta só/i)).toBeVisible();
    await expect(
      page.getByText(/cada um avalia uma vez, e ninguém avalia a si mesmo/i),
    ).toBeVisible();
    await expect(page.getByText(/a lupa confere o cadastro/i)).toBeVisible();
  });
});
