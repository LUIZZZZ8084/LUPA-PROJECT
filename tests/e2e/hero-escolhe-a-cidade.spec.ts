import { expect, test } from "@playwright/test";

/**
 * A busca do hero oferece a cidade logo depois do estado (#380).
 *
 * Antes, só se escolhia o estado, e a cidade vinha depois da busca, no
 * filtro da lista. Agora, escolhido o estado, aparece "Cidade", com "Todas
 * as cidades" (o estado inteiro) como padrão. As cidades chegam sob demanda,
 * só as do estado escolhido.
 *
 * Com sessão: sem ela, `/vagas` manda para o login, e o que se confere aqui
 * é a lista de verdade, com os dois filtros já marcados.
 */
test.describe("hero: estado e cidade", () => {
  test("escolher o estado e a cidade abre a lista com os dois filtros", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByLabel("Estado").selectOption("MT");
    const cidade = page.getByLabel("Cidade");
    await expect(cidade).toBeVisible();
    await expect(cidade).toHaveValue("");

    // A lista chega sob demanda: espera Sinop existir antes de escolher.
    await expect(cidade.locator('option[value="Sinop - MT"]')).toHaveCount(1);
    await cidade.selectOption("Sinop - MT");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/vagas\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("uf")).toBe("MT");
    expect(url.searchParams.get("cidade")).toBe("Sinop - MT");
  });

  test("'Todas as cidades' busca o estado inteiro", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Estado").selectOption("MT");
    await expect(page.getByLabel("Cidade")).toHaveValue("");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/vagas\?uf=MT$/);
  });

  test("a mesma escolha vale para Serviços", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Serviços" }).click();
    await page.getByLabel("Estado").selectOption("MT");
    const cidade = page.getByLabel("Cidade");
    await expect(cidade.locator('option[value="Sinop - MT"]')).toHaveCount(1);
    await cidade.selectOption("Sinop - MT");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/servicos\?/);
    expect(new URL(page.url()).searchParams.get("cidade")).toBe("Sinop - MT");
  });

  test("sem estado não há cidade, e trocar o estado a limpa", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByLabel("Cidade")).toHaveCount(0);

    await page.getByLabel("Estado").selectOption("MT");
    const cidade = page.getByLabel("Cidade");
    await expect(cidade.locator('option[value="Sinop - MT"]')).toHaveCount(1);
    await cidade.selectOption("Sinop - MT");

    await page.getByLabel("Estado").selectOption("SP");
    await expect(page.getByLabel("Cidade")).toHaveValue("");
  });

  /** O cartão cresce uma linha com a cidade; a página não pode ganhar rolagem lateral. */
  test("sem rolagem horizontal com a cidade, no celular", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    await page.getByLabel("Estado").selectOption("MT");
    await expect(page.getByLabel("Cidade")).toBeVisible();

    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
  });

  /**
   * No desktop o botão vai para a direita, alto, e o campo de cidade fica ao
   * lado do estado, não por baixo: as duas linhas do cartão se leem na ordem
   * em que o DOM está.
   */
  test("no desktop, estado e cidade ficam lado a lado, e o botão à direita", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByLabel("Estado").selectOption("MT");

    const [estado, cidade, buscar, termo] = await Promise.all([
      page.getByLabel("Estado").boundingBox(),
      page.getByLabel("Cidade").boundingBox(),
      page.getByRole("button", { name: "Buscar" }).boundingBox(),
      page.getByRole("searchbox").boundingBox(),
    ]);

    // Mesma linha, estado à esquerda da cidade.
    expect(Math.abs((estado?.y ?? 0) - (cidade?.y ?? 99))).toBeLessThanOrEqual(
      1,
    );
    expect(estado?.x ?? 0).toBeLessThan(cidade?.x ?? 0);
    // O termo está acima das duas.
    expect((termo?.y ?? 99) + (termo?.height ?? 0)).toBeLessThanOrEqual(
      (estado?.y ?? 0) + 1,
    );
    // O botão está à direita de tudo e é mais alto que um campo.
    expect(buscar?.x ?? 0).toBeGreaterThan(
      (cidade?.x ?? 0) + (cidade?.width ?? 0) - 1,
    );
    expect(buscar?.height ?? 0).toBeGreaterThan((estado?.height ?? 99) + 8);
  });
});
