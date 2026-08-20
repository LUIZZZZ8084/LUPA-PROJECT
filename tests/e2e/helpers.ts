import type { Page } from "@playwright/test";

/**
 * Espera o React assumir o controle da página.
 *
 * Sem isso, o teste altera o HTML servido antes de existir listener e o
 * clique some no vazio — que é exatamente o que acontece com uma pessoa
 * num aparelho lento. O app continua funcionando nesse intervalo porque a
 * barra de filtros é um form GET de verdade; o teste, porém, precisa
 * exercitar o caminho com JavaScript.
 */
export async function aguardarHidratacao(page: Page, seletor = "select") {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return Object.keys(el).some((k) => k.startsWith("__react"));
    },
    seletor,
    { timeout: 15_000 },
  );
}
