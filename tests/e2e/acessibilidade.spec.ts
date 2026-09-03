import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
  rotasProfundasDaEmpresa,
} from "./helpers";
import { ROTAS, ROTAS_EMPRESA } from "./rotas";

/**
 * As violações de uma página, já reduzidas ao que se lê num relatório.
 *
 * Extraído para que a varredura de empresa meça exatamente o mesmo — duas
 * cópias da configuração do axe divergem na primeira vez que alguém
 * acrescenta uma tag num lugar só.
 */
async function violacoesDe(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  return resultado.violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    descricao: v.description,
    elementos: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 120)),
  }));
}

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

    const violacoes = await violacoesDe(page);

    expect(
      violacoes,
      `${nome} (${path}):\n${JSON.stringify(violacoes, null, 2)}`,
    ).toEqual([]);
  });
}

/**
 * As rotas que só a empresa alcança.
 *
 * Ficaram fora da varredura por um motivo estrutural, não por descuido: a
 * sessão compartilhada da suíte é de candidato, e depois que `/empresa`
 * ganhou portão de papel elas respondem 404 com ela. Medir aqui é medir a
 * tela certa.
 */
test.describe("rotas da empresa", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  for (const { path, nome } of ROTAS_EMPRESA) {
    test(`${nome} sem violações de acessibilidade`, async ({ page }) => {
      await page.goto(path);
      await aguardarAnimacoes(page);
      await expect(violacoesDe(page)).resolves.toEqual([]);
    });
  }

  /**
   * Ficha do candidato e edição de vaga, com o id resolvido pelo painel.
   *
   * São as duas telas em que a empresa passa mais tempo — ler currículo e
   * corrigir anúncio — e nenhuma delas jamais passou por contraste.
   */
  test("as telas com id também passam", async ({ page }) => {
    const profundas = await rotasProfundasDaEmpresa(page);
    expect(profundas.length, "o painel não ofereceu nenhum link").toBe(2);

    for (const { path, nome } of profundas) {
      await page.goto(path);
      await aguardarAnimacoes(page);

      const violacoes = await violacoesDe(page);
      expect(violacoes, `${nome} (${path})`).toEqual([]);
    }
  });
});
