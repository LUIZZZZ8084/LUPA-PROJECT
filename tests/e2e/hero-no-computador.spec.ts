import { expect, type Page, test } from "@playwright/test";

/**
 * O hero da home no computador (#465).
 *
 * Era um banner da largura toda com o meio vazio, e a busca, o selo e os
 * números soltos embaixo, cada um com uma largura. A partir de `lg` a busca
 * mora dentro do banner, numa coluna à esquerda, e a foto fica à direita.
 * No celular nada muda: o banner é a faixa do título, e a busca vem embaixo.
 *
 * O "banner" aqui é a caixa onde a foto está desenhada (o pai da foto), e
 * não um atributo de teste: assim a medida vale para qualquer arranjo do
 * DOM, e a composição antiga reprova.
 */
type Caixa = { x: number; y: number; direita: number; base: number };

async function medidas(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>(
      'img[src*="trabalhador"]',
    );
    return Boolean(img?.complete && img.naturalWidth > 0);
  });
  return page.evaluate(() => {
    const caixa = (e: Element | null | undefined) => {
      const r = e?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, direita: r.right, base: r.bottom } : null;
    };
    const foto = document.querySelector('img[src*="trabalhador"]');
    const busca = document.querySelector('form:has(input[name="q"])');
    return {
      banner: caixa(foto?.parentElement),
      foto: caixa(foto),
      busca: caixa(busca),
      botao: caixa(busca?.querySelector('button[type="submit"]')),
      sobra: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

function dentro(de: Caixa, a: Caixa) {
  return (
    a.x >= de.x - 1 &&
    a.y >= de.y - 1 &&
    a.direita <= de.direita + 1 &&
    a.base <= de.base + 1
  );
}

for (const quem of ["visitante", "com conta"] as const) {
  test.describe(quem, () => {
    if (quem === "visitante") {
      test.use({ storageState: { cookies: [], origins: [] } });
    }

    for (const largura of [1024, 1280, 1920]) {
      test(`em ${largura} px a busca fica dentro do banner, sem encostar na foto`, async ({
        page,
      }, info) => {
        test.skip(info.project.name !== "desktop", "larguras de computador");
        await page.setViewportSize({ width: largura, height: 900 });
        const m = await medidas(page);

        if (!m.banner || !m.foto || !m.busca || !m.botao) {
          throw new Error(`faltou medir: ${JSON.stringify(m)}`);
        }
        expect(dentro(m.banner, m.busca), "a busca dentro do banner").toBe(
          true,
        );
        expect(
          m.busca.direita,
          "a busca termina antes de a foto começar",
        ).toBeLessThanOrEqual(m.foto.x + 1);
        expect(dentro(m.busca, m.botao), "o botão dentro do cartão").toBe(true);
        expect(m.sobra, "sem rolagem horizontal").toBeLessThanOrEqual(0);
      });
    }

    test("no celular a busca continua embaixo do banner", async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "desktop", "a largura é posta à mão");
      await page.setViewportSize({ width: 375, height: 812 });
      const m = await medidas(page);

      if (!m.banner || !m.busca) throw new Error("faltou medir");
      expect(m.busca.y).toBeGreaterThanOrEqual(m.banner.base);
      expect(m.sobra).toBeLessThanOrEqual(0);
    });
  });
}
