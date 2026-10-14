import { expect, test } from "@playwright/test";

/**
 * A lista que abre ao tocar num filtro, nos dois temas (#462).
 *
 * O navegador desenha essa lista com o fundo e a cor do `<option>`. Sem
 * regra própria, o fundo era transparente e o texto herdava a cor do tema:
 * no escuro, texto claro sobre o branco do navegador, legível só sob o
 * mouse. O popup nativo não aparece em captura de tela, então o que se
 * confere é o que o navegador usa para desenhá-lo: o estilo calculado.
 */
for (const tema of ["claro", "escuro"] as const) {
  test(`a lista do filtro tem fundo próprio e contraste, no tema ${tema}`, async ({
    page,
  }) => {
    await page.goto("/vagas");
    await page.evaluate((t) => {
      if (t === "escuro") document.documentElement.dataset.theme = "dark";
      else delete document.documentElement.dataset.theme;
    }, tema);

    const opcao = await page
      .locator('form select[name="tipo"] option')
      .nth(1)
      .evaluate((el) => {
        const estilo = getComputedStyle(el);
        const canais = (css: string) =>
          (css.match(/[\d.]+/g) ?? []).map(Number);
        const luz = ([r, g, b]: number[]) => {
          const [R, G, B] = [r, g, b].map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * R + 0.7152 * G + 0.0722 * B;
        };
        const fundo = canais(estilo.backgroundColor);
        const cor = canais(estilo.color);
        const [a, b] = [luz(fundo), luz(cor)].sort((x, y) => y - x);
        return {
          fundo: estilo.backgroundColor,
          alfa: fundo.length > 3 ? fundo[3] : 1,
          contraste: (a + 0.05) / (b + 0.05),
        };
      });

    expect(opcao.alfa, `fundo da opção: ${opcao.fundo}`).toBe(1);
    expect(opcao.contraste).toBeGreaterThanOrEqual(4.5);
  });
}
