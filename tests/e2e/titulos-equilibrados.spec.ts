import { expect, test } from "@playwright/test";

/**
 * Os títulos equilibram as linhas (#483): `text-wrap: balance` em h1 a h3.
 *
 * Um título que quebra em três linhas deixava uma palavra sozinha, no celular:
 * "Encontre seu / próximo / trabalho". O que se mede é o estilo calculado,
 * porque é o que o navegador aplica, e a home tem títulos dos dois níveis.
 * A regra em si está em `tests/unit/titulos-equilibrados.test.ts`.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("o título do banner e os das seções equilibram as linhas", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const estilos = await page.evaluate(() =>
    ["h1", "h2"].map((tag) => {
      const e = document.querySelector(tag);
      return {
        tag,
        existe: Boolean(e),
        balance: e ? getComputedStyle(e).textWrapStyle === "balance" : false,
      };
    }),
  );

  expect(estilos).toEqual([
    { tag: "h1", existe: true, balance: true },
    { tag: "h2", existe: true, balance: true },
  ]);
});
