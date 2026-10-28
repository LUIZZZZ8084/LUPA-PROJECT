import { expect, type Page, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * Alvos de toque de 44 px nas telas principais (#481).
 *
 * No celular os botões `size="sm"` tinham 36 px, o botão de tema 40, o logo do
 * cabeçalho 35, e links soltos como "Voltar ao perfil" e "Lembrei a senha"
 * 16 a 20. O WCAG 2.2 AA pede 24 px, e Android e iOS recomendam 44 a 48:
 * quem usa o app na rua, com o polegar, erra o toque num alvo pequeno e
 * acerta o vizinho. Em aparelho de toque (`pointer: coarse`) os alvos passam
 * a ter 44 px; no desktop a densidade não muda.
 *
 * Só roda onde há toque: é a variante `pointer-coarse` que se vigia, e o
 * projeto de desktop mede 36 px de propósito.
 *
 * O que fica de fora, e por quê:
 * - link dentro de uma frase ("Já tem conta? Entrar"): a exceção do próprio
 *   WCAG, que não pede alvo de 44 px no meio do texto;
 * - o que não aparece (`sr-only`, de 1 px) e o painel do Next em
 *   desenvolvimento;
 * - o campo marcável (círculo ou quadrado de 13 a 16 px): o alvo de verdade é
 *   o rótulo em volta dele, que é o que se mede;
 * - o link ou rótulo "esticado" (`::after` absoluto): o alvo é o cartão.
 */
const SEM_SESSAO = { cookies: [], origins: [] };
const MINIMO = 43.5; // 44 px, com folga para o arredondamento

type Pequeno = { onde: string; quem: string; w: number; h: number };

/** Os alvos de toque da página com menos de 44 px, já sem as exceções. */
async function alvosPequenos(page: Page): Promise<Pequeno[]> {
  return page.evaluate((minimo) => {
    const rotulo = (e: Element) =>
      (
        e.getAttribute("aria-label") ||
        (e as HTMLElement).innerText ||
        e.getAttribute("name") ||
        e.getAttribute("placeholder") ||
        e.tagName
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 36);

    const visivel = (r: DOMRect, e: Element) => {
      const s = getComputedStyle(e);
      return (
        r.width > 1 &&
        r.height > 1 &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      );
    };

    /** Link no meio de uma frase: o pai tem mais texto do que o próprio link. */
    const dentroDeFrase = (e: Element) => {
      if (e.tagName !== "A") return false;
      const pai = e.parentElement;
      if (!pai || !["P", "SPAN", "LI", "DIV"].includes(pai.tagName)) {
        return false;
      }
      const dele = (e.textContent ?? "").trim();
      const doPai = (pai.textContent ?? "").trim();
      return pai.tagName === "P" && doPai.length > dele.length + 3;
    };

    /**
     * O link (ou rótulo) "esticado": o `::after` absoluto cobre o cartão que o
     * contém, e é o cartão que recebe o toque. O texto do link, de 23 px,
     * não é o alvo. Vale para o nome do profissional e para o rótulo do
     * "Quero que empresas me encontrem".
     */
    const alvoEsticado = (e: Element): Element | null => {
      const lista = [
        e,
        ...(e instanceof HTMLInputElement && e.labels ? [...e.labels] : []),
      ];
      for (const t of lista) {
        const depois = getComputedStyle(t, "::after");
        const temConteudo =
          depois.content !== "none" && depois.content !== "normal";
        if (depois.position === "absolute" && temConteudo) {
          const pai = (t as HTMLElement).offsetParent;
          if (pai) return pai;
        }
      }
      return null;
    };

    const achados: { onde: string; quem: string; w: number; h: number }[] = [];
    const candidatos = document.querySelectorAll(
      "a[href], button, [role=button], select, input:not([type=hidden]), textarea, summary",
    );
    for (const e of candidatos) {
      if (e.closest("nextjs-portal, [data-nextjs-toast]")) continue;
      if (e.matches('a[href="#conteudo"]')) continue;
      if (dentroDeFrase(e)) continue;

      // Campo marcável: o alvo é o rótulo que o envolve.
      const marcavel =
        e instanceof HTMLInputElement &&
        (e.type === "radio" || e.type === "checkbox");
      const alvo =
        alvoEsticado(e) ?? (marcavel ? (e.closest("label") ?? e) : e);

      const r = alvo.getBoundingClientRect();
      if (!visivel(r, alvo)) continue;
      const semTexto = ((alvo as HTMLElement).innerText ?? "").trim() === "";
      const pequeno = r.height < minimo || (semTexto && r.width < minimo);
      if (pequeno) {
        achados.push({
          onde: location.pathname,
          quem: `${e.tagName.toLowerCase()}: ${rotulo(e)}`,
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return achados;
  }, MINIMO);
}

async function conferir(page: Page, rota: string) {
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  expect(await alvosPequenos(page), `alvos pequenos em ${rota}`).toEqual([]);
}

test.describe("alvos de toque, sem sessão", () => {
  test.skip(({ hasTouch }) => !hasTouch, "só aparelho de toque");
  test.use({ storageState: SEM_SESSAO });

  for (const rota of ["/", "/entrar", "/cadastro", "/esqueci-senha"]) {
    test(`${rota}: nada abaixo de 44 px`, async ({ page }) => {
      await conferir(page, rota);
    });
  }
});

test.describe("alvos de toque, candidato", () => {
  test.skip(({ hasTouch }) => !hasTouch, "só aparelho de toque");

  for (const rota of [
    "/",
    "/vagas",
    "/servicos",
    "/perfil",
    "/perfil/editar",
    "/avisos",
  ]) {
    test(`${rota}: nada abaixo de 44 px`, async ({ page }) => {
      await conferir(page, rota);
    });
  }

  test("o detalhe de uma vaga e o de um profissional", async ({ page }) => {
    await page.goto("/vagas");
    const vaga = await page
      .locator('a[href^="/vagas/"]')
      .first()
      .getAttribute("href");
    await conferir(page, vaga ?? "/vagas");

    await page.goto("/servicos");
    const prof = await page
      .locator('a[href^="/servicos/"]')
      .first()
      .getAttribute("href");
    await conferir(page, prof ?? "/servicos");
  });
});

test.describe("alvos de toque, empresa", () => {
  test.skip(({ hasTouch }) => !hasTouch, "só aparelho de toque");
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  for (const rota of [
    "/empresa",
    "/empresa/creditos",
    "/empresa/vagas/nova",
    "/empresa/vagas",
    "/empresa/funil",
  ]) {
    test(`${rota}: nada abaixo de 44 px`, async ({ page }) => {
      await conferir(page, rota);
    });
  }
});
