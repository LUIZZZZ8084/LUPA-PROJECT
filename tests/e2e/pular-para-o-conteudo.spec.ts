import { expect, test } from "@playwright/test";

/**
 * "Pular para o conteúdo" (#479).
 *
 * O cabeçalho vem antes de tudo na ordem de Tab: na home são seis paradas
 * (logo, três itens de menu, tema, entrar) antes de chegar na busca, e em
 * toda página. O link é o primeiro item da ordem, só aparece quando recebe
 * foco, e leva o foco ao `<main>`.
 *
 * Sem sessão, que é como quem chega pelo link vê a home e as telas de
 * entrada. A tela de vagas, que pede sessão, é conferida no segundo bloco.
 */
const SEM_SESSAO = { cookies: [], origins: [] };

async function caixaDoLink(page: import("@playwright/test").Page) {
  return page
    .getByRole("link", { name: "Pular para o conteúdo" })
    .evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
}

async function conferir(page: import("@playwright/test").Page, rota: string) {
  await page.goto(rota);

  // Escondido até receber foco: do tamanho de um ponto.
  const escondido = await caixaDoLink(page);
  expect(escondido.w).toBeLessThanOrEqual(1);
  expect(escondido.h).toBeLessThanOrEqual(1);

  // O primeiro Tab da página cai nele, e ele aparece inteiro na tela.
  await page.keyboard.press("Tab");
  const link = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(link).toBeFocused();
  const visivel = await caixaDoLink(page);
  expect(visivel.w).toBeGreaterThan(80);
  expect(visivel.h).toBeGreaterThan(24);
  expect(visivel.x).toBeGreaterThanOrEqual(0);
  expect(visivel.y).toBeGreaterThanOrEqual(0);

  // Enter leva o foco ao conteúdo, e o conteúdo não ganha anel de foco.
  await page.keyboard.press("Enter");
  const conteudo = page.locator("main#conteudo");
  await expect(conteudo).toBeFocused();
  await expect(page).toHaveURL(/#conteudo$/);
  expect(await conteudo.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
    "none",
  );

  // O próximo Tab segue de dentro do conteúdo: o cabeçalho ficou para trás.
  await page.keyboard.press("Tab");
  const dentro = await page.evaluate(() =>
    document.querySelector("main")?.contains(document.activeElement),
  );
  expect(dentro).toBe(true);
}

test.describe("pular para o conteúdo, sem sessão", () => {
  test.use({ storageState: SEM_SESSAO });

  for (const rota of ["/", "/entrar", "/cadastro"]) {
    test(`${rota}: Tab foca o link e Enter leva ao conteúdo`, async ({
      page,
    }) => {
      await conferir(page, rota);
    });
  }
});

test.describe("pular para o conteúdo, com sessão", () => {
  test("/vagas: o link vem antes do cabeçalho e da barra de navegação", async ({
    page,
  }) => {
    await conferir(page, "/vagas");
  });
});
