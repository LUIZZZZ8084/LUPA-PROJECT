import { expect, test } from "@playwright/test";
import { LARGURAS, ROTAS } from "./rotas";

/**
 * Trava contra o bug que fazia a página rolar para o lado no celular.
 *
 * Causas originais: grades sem `grid-cols-1` (a coluna implícita adotava o
 * min-content do card) e `truncate` aplicado a contêineres flex. Ambas
 * passavam despercebidas no desktop, que é onde se desenvolve — e apareciam
 * justamente no aparelho de quem vai usar o produto.
 */

// Só o projeto desktop roda: o viewport é controlado dentro do teste.
test.describe.configure({ mode: "parallel" });

for (const { w, h, nome: larguraNome } of LARGURAS) {
  test.describe(`largura ${larguraNome}`, () => {
    for (const { path, nome } of ROTAS) {
      test(`${nome} não rola horizontalmente`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
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

        const medida = await page.evaluate(() => {
          const doc = document.documentElement;
          const vw = doc.clientWidth;
          const culpados: { tag: string; cls: string; right: number }[] = [];

          for (const el of Array.from(document.querySelectorAll("body *"))) {
            const r = el.getBoundingClientRect();
            // Ignora o que está oculto ou fora de fluxo por posicionamento.
            if (r.width === 0 && r.height === 0) continue;
            if (r.right > vw + 1) {
              culpados.push({
                tag: el.tagName.toLowerCase(),
                cls: String((el as HTMLElement).className || "").slice(0, 90),
                right: Math.round(r.right),
              });
            }
          }

          return {
            vw,
            scrollW: doc.scrollWidth,
            culpados: culpados.slice(0, 5),
          };
        });

        expect(
          medida.scrollW,
          `A página vaza ${medida.scrollW - medida.vw}px. Primeiros culpados: ` +
            JSON.stringify(medida.culpados, null, 2),
        ).toBeLessThanOrEqual(medida.vw);
      });
    }
  });
}

test.describe("elementos de largura fixa", () => {
  test("nenhum elemento é mais largo que a tela em 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });

    for (const { path, nome } of ROTAS) {
      await page.goto(path);

      const largos = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll("body *"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            // Contêineres com rolagem horizontal própria são intencionais.
            const ox = getComputedStyle(el).overflowX;
            if (ox === "auto" || ox === "scroll") return false;
            return r.width > vw + 1;
          })
          .map((el) => String((el as HTMLElement).className || "").slice(0, 70))
          .slice(0, 4);
      });

      expect(largos, `${nome} (${path})`).toEqual([]);
    }
  });
});
