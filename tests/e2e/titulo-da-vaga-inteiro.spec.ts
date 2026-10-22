import { expect, type Page, test } from "@playwright/test";

/**
 * O título da vaga não aparece cortado em uma linha só (#479).
 *
 * O selo "Novo" ficava ao lado do título e tirava uns 50 px dele: no celular
 * aparecia "Operador de Máquinas Agríc…" na lista e "Operador de M…" no
 * carrossel da home. O cargo é o que a pessoa lê primeiro. Agora o título tem
 * até duas linhas; cortar com reticências só pode acontecer se o cargo passar
 * de duas.
 *
 * Mede-se o que o navegador desenhou: título cortado tem `scrollWidth` ou
 * `scrollHeight` maior que o espaço dele. Os cargos de demonstração cabem em
 * duas linhas na largura mais estreita que o app suporta (360 px).
 */
const SEM_SESSAO = { cookies: [], origins: [] };

/** Os títulos de vaga visíveis na tela e quais estão cortados. */
async function titulosDeVaga(page: Page) {
  return page.evaluate(() => {
    const titulos = [
      ...document.querySelectorAll<HTMLElement>('a[href^="/vagas/"] h3'),
    ];
    return titulos.map((h) => ({
      texto: h.innerText.replace(/\s+/g, " ").trim(),
      // Com `truncate` o corte é para o lado (scrollWidth); com `line-clamp`,
      // para baixo (scrollHeight). O defeito antigo era o primeiro.
      cortado:
        h.scrollWidth > h.clientWidth + 1 ||
        h.scrollHeight > h.clientHeight + 1,
      linhas: Math.round(
        h.getBoundingClientRect().height /
          Number.parseFloat(getComputedStyle(h).lineHeight),
      ),
    }));
  });
}

test.describe("título da vaga inteiro, a 360 px", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test.describe("home, sem sessão", () => {
    test.use({ storageState: SEM_SESSAO });

    test("nenhum título do carrossel aparece cortado", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const titulos = await titulosDeVaga(page);
      expect(titulos.length).toBeGreaterThanOrEqual(3);
      expect(titulos.filter((t) => t.cortado)).toEqual([]);
      expect(titulos.every((t) => t.linhas <= 2)).toBe(true);
    });
  });

  test("a lista de vagas mostra os títulos inteiros", async ({ page }) => {
    await page.goto("/vagas");
    await page.waitForLoadState("networkidle");

    const titulos = await titulosDeVaga(page);
    expect(titulos.length).toBeGreaterThanOrEqual(5);
    expect(titulos.filter((t) => t.cortado)).toEqual([]);

    // O cargo mais comprido da demonstração, que antes ficava em reticências.
    const longo = titulos.find((t) => t.texto.includes("Máquinas Agrícolas"));
    expect(longo?.texto).toBe("Operador de Máquinas Agrícolas");
  });
});
