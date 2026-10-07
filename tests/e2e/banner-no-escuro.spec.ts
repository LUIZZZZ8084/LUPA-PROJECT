import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * O banner da home tem a mesma forma nos dois temas (#378).
 *
 * Até a #374 havia uma foto para cada tema, e quem alternava via o banner
 * trocar de composição. Agora é uma foto só, o homem recortado do fundo, e as
 * mesmas faixas; só a cor muda. O que se cobra aqui é a **medida**: o
 * retângulo do banner, o da foto e o do título nos mesmos lugares, nos dois
 * temas, em desktop e em celular.
 *
 * O tema é uma escolha guardada no navegador (`lupa:tema`) e lida por um
 * script antes da primeira pintura, então aqui ela é posta antes de a página
 * carregar, como faz quem já tinha escolhido. A home é pública: sem sessão,
 * que é como quem recebe o link a vê.
 */
const SEM_SESSAO = { cookies: [], origins: [] };

type Tema = "light" | "dark";

async function abrirNo(page: Page, tema: Tema) {
  await page.addInitScript((t) => localStorage.setItem("lupa:tema", t), tema);
  await page.goto("/");
  // Claro é o padrão e não tem atributo nenhum; escuro põe `data-theme="dark"`.
  if (tema === "dark") {
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } else {
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme",
      "dark",
    );
  }
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>(
      'img[src*="trabalhador"]',
    );
    return Boolean(img?.complete && img.naturalWidth > 0);
  });
}

/** Onde estão o banner, a foto e o texto, em pixels, arredondados. */
async function medidas(page: Page) {
  return page.evaluate(() => {
    const caixa = (e: Element | null) => {
      const r = e?.getBoundingClientRect();
      return r ? [r.x, r.y, r.width, r.height].map((n) => Math.round(n)) : null;
    };
    const banner = document.querySelector("section:has(h1)");
    return {
      banner: caixa(banner),
      foto: caixa(banner?.querySelector("img") ?? null),
      titulo: caixa(banner?.querySelector("h1") ?? null),
      frase: caixa(banner?.querySelector("p") ?? null),
      faixas: [...(banner?.querySelectorAll("[aria-hidden]") ?? [])].map(caixa),
    };
  });
}

test.describe("banner da home, os dois temas", () => {
  test.use({ storageState: SEM_SESSAO });

  for (const [nome, largura, altura] of [
    ["desktop", 1280, 800],
    ["celular", 375, 812],
  ] as const) {
    test(`tem as mesmas medidas no claro e no escuro (${nome})`, async ({
      browser,
    }) => {
      const resultado: Record<Tema, Awaited<ReturnType<typeof medidas>>> = {
        light: await (async () => {
          const ctx = await browser.newContext({
            viewport: { width: largura, height: altura },
          });
          const page = await ctx.newPage();
          await abrirNo(page, "light");
          const m = await medidas(page);
          await ctx.close();
          return m;
        })(),
        dark: await (async () => {
          const ctx = await browser.newContext({
            viewport: { width: largura, height: altura },
          });
          const page = await ctx.newPage();
          await abrirNo(page, "dark");
          const m = await medidas(page);
          await ctx.close();
          return m;
        })(),
      };

      expect(resultado.light.banner).not.toBeNull();
      expect(resultado.dark).toEqual(resultado.light);
    });
  }

  for (const tema of ["light", "dark"] as const) {
    test(`mostra a mesma foto no tema ${tema}`, async ({ page }) => {
      await abrirNo(page, tema);

      const foto = page.locator('section:has(h1) img[src*="trabalhador"]');
      await expect(foto).toHaveCount(1);
      await expect(foto).toBeVisible();
    });

    /**
     * O desfoque do pé da foto (#382) tem de existir de verdade, e estar
     * exatamente sobre a foto: o navegador aplicou o `backdrop-filter`, e a
     * caixa da camada é a da foto, no tema e no tamanho de tela que for.
     */
    test(`o desfoque do pé cobre a foto, no tema ${tema}`, async ({ page }) => {
      await abrirNo(page, tema);

      const { filtro, mascara, desfoque, foto } = await page.evaluate(() => {
        const banner = document.querySelector("section:has(h1)");
        const camada = banner?.querySelector("[data-desfoque-do-pe]");
        const img = banner?.querySelector("img");
        const caixa = (e: Element | null | undefined) => {
          const r = e?.getBoundingClientRect();
          return r
            ? [r.x, r.y, r.width, r.height].map((n) => Math.round(n))
            : null;
        };
        const estilo = camada ? getComputedStyle(camada) : null;
        return {
          filtro: estilo?.backdropFilter ?? "",
          mascara: estilo?.maskImage ?? "",
          desfoque: caixa(camada),
          foto: caixa(img),
        };
      });

      expect(filtro).toContain("blur(");
      expect(mascara).toContain("linear-gradient");
      expect(desfoque).not.toBeNull();
      // Mesma caixa, com 1 px de folga para o arredondamento.
      for (let i = 0; i < 4; i++) {
        expect(
          Math.abs((desfoque?.[i] ?? 0) - (foto?.[i] ?? 99)),
        ).toBeLessThanOrEqual(1);
      }
    });

    /**
     * O contraste do título e da frase sobre o fundo do tema. Só o banner é
     * medido: o resto da home no escuro tem a sua própria história, e uma
     * violação de fora não pode esconder uma de dentro nem o contrário.
     */
    test(`o banner não tem violações de acessibilidade no tema ${tema}`, async ({
      page,
    }) => {
      await abrirNo(page, tema);

      const resultado = await new AxeBuilder({ page })
        .include("section:has(h1)")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(
        resultado.violations.map((v) => ({
          regra: v.id,
          elementos: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 100)),
        })),
      ).toEqual([]);
    });

    test(`sem rolagem horizontal no celular, tema ${tema}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await abrirNo(page, tema);

      const sobra = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(sobra).toBeLessThanOrEqual(0);
    });
  }
});
