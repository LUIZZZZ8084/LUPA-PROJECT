import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA, aguardarAnimacoes } from "./helpers";

/**
 * O perfil de quem se candidatou, aberto pela empresa (#533).
 *
 * A mensagem pronta que o candidato manda no WhatsApp leva o link do perfil
 * dele. Em demonstração, `cnd-1` tem candidatura à vaga de Operador de
 * Máquinas e não ligou "quero que empresas me encontrem": é exatamente o
 * caso que respondia 404.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

test.describe("perfil de quem se candidatou, pela empresa", () => {
  test("abre sem a pessoa ter consentido na busca, com as opções de funil", async ({
    page,
  }) => {
    const resposta = await page.goto("/candidatos/cnd-1");
    expect(resposta?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: "Everton Rodrigues" }),
    ).toBeVisible();
    await expect(page.getByText("No funil de candidatos")).toBeVisible();
    await expect(
      page.getByText("Operador de Máquinas Agrícolas").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Estágio da candidatura" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Abrir ficha com currículo" }),
    ).toHaveAttribute("href", /\/candidaturas\/app-1$/);
  });

  test("a empresa chama pelo WhatsApp com a mensagem de candidatura, não a de orçamento", async ({
    page,
  }) => {
    await page.goto("/candidatos/cnd-1");

    const chamar = page.getByRole("link", { name: "Chamar no WhatsApp" });
    await expect(chamar).toBeVisible();
    const texto = new URL(
      (await chamar.getAttribute("href")) ?? "",
    ).searchParams.get("text");
    expect(texto).toContain("Vimos sua candidatura");
    expect(texto).not.toContain("orçamento");
  });

  test("não tem violação de acessibilidade", async ({ page }) => {
    await page.goto("/candidatos/cnd-1");
    await aguardarAnimacoes(page);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});
