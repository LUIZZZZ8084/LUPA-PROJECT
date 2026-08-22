import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { aguardarAnimacoes } from "./helpers";
import { ROTAS } from "./rotas";

/**
 * Acessibilidade não é detalhe aqui: parte do público tem baixa
 * escolaridade digital, usa aparelho antigo e fonte aumentada. Contraste e
 * rótulo correto são o que faz a pessoa conseguir usar.
 */
for (const { path, nome } of ROTAS) {
  test(`${nome} sem violações de acessibilidade`, async ({ page }) => {
    /*
     * `load`, não `networkidle`.
     *
     * `networkidle` espera 500 ms sem requisição nenhuma, e com o app fechado
     * por login cada renderização passou a ler sessão: sob paralelismo, a rede
     * às vezes nunca fica quieta pelo tempo exigido e o teste estoura sem que
     * haja defeito. A própria documentação do Playwright desaconselha a
     * espera. Estes testes medem layout do DOM já montado — `load` basta, e a
     * medição que interessa vem do `page.evaluate` logo depois.
     */
    await page.goto(path);
    await aguardarAnimacoes(page);

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
