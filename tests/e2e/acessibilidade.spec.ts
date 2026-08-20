import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROTAS } from "./rotas";

/**
 * Acessibilidade não é detalhe aqui: parte do público tem baixa
 * escolaridade digital, usa aparelho antigo e fonte aumentada. Contraste e
 * rótulo correto são o que faz a pessoa conseguir usar.
 */
for (const { path, nome } of ROTAS) {
  test(`${nome} sem violações de acessibilidade`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const violacoes = resultado.violations.map((v) => ({
      regra: v.id,
      impacto: v.impact,
      descricao: v.description,
      elementos: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 120)),
    }));

    expect(
      violacoes,
      `${nome} (${path}):\n${JSON.stringify(violacoes, null, 2)}`,
    ).toEqual([]);
  });
}
