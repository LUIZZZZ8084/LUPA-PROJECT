import { expect, test } from "@playwright/test";

/**
 * Ganhar foco por teclado não muda a forma de quem o recebe (#479).
 *
 * A regra global de foco, por estar fora de qualquer camada, forçava
 * `border-radius: 6px` em todo `:focus-visible` e vencia os utilitários do
 * Tailwind: o botão redondo do tema virava quadrado, a aba em pílula idem,
 * e o "Buscar" e os cartões perdiam o raio. Ninguém vê isso olhando o CSS
 * de um componente: o raio certo está lá, e só perde no foco.
 *
 * O teste anda pelas paradas de Tab e compara o raio de cada elemento com
 * foco e sem. Em `rounded-full` o raio calculado é enorme, e o 6 px da regra
 * antiga é a diferença que ele pega.
 */
const SEM_SESSAO = { cookies: [], origins: [] };

test.describe("foco do teclado", () => {
  test.use({ storageState: SEM_SESSAO });

  for (const rota of ["/", "/entrar"]) {
    test(`${rota}: o raio não muda com o foco`, async ({ page }) => {
      await page.goto(rota);
      // Esperar o fim da animação de entrada: ela mexe em transform, não em
      // raio, mas medir um elemento ainda sem layout daria 0 px nos dois.
      await page.waitForLoadState("networkidle");

      const medidas: { quem: string; emFoco: string; emRepouso: string }[] = [];
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => {
          const e = document.activeElement as HTMLElement | null;
          if (!e || e === document.body || e.tagName === "NEXTJS-PORTAL") {
            return null;
          }
          // O "Pular para o conteúdo" só tem forma quando recebe foco: é
          // `sr-only` em repouso e ganha cantos arredondados no foco, de
          // propósito. Não é o defeito que este teste vigia.
          if (e.matches('a[href="#conteudo"]')) return null;
          const quem = `${e.tagName.toLowerCase()}:${(
            e.getAttribute("aria-label") ||
            e.innerText ||
            e.getAttribute("name") ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 28)}`;
          const emFoco = getComputedStyle(e).borderTopLeftRadius;
          e.blur();
          const emRepouso = getComputedStyle(e).borderTopLeftRadius;
          // Devolve o foco, para o próximo Tab seguir dali.
          e.focus();
          return { quem, emFoco, emRepouso };
        });
        if (m) medidas.push(m);
      }

      // Não vale passar medindo nada: a home tem mais de dez paradas.
      expect(medidas.length).toBeGreaterThanOrEqual(8);
      expect(medidas.filter((m) => m.emFoco !== m.emRepouso)).toEqual([]);
      // E ao menos um elemento redondo ou arredondado entrou na conta: com
      // todos em 0 px, a comparação não provaria nada.
      expect(medidas.some((m) => Number.parseFloat(m.emRepouso) > 6)).toBe(
        true,
      );
    });
  }
});
