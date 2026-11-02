import { expect, type Page, test } from "@playwright/test";

/**
 * A ação principal presa no pé da tela (#479).
 *
 * "Candidatar-se" e "Conversar no WhatsApp" eram o último bloco da página, mais
 * de mil pixels abaixo do topo no celular. Agora a barra de ação fica na
 * primeira tela, acima da navegação inferior, e assenta onde o lugar natural
 * dela chega. Um elemento `sticky` só se prova no navegador: o que se mede
 * aqui são posições, no celular (390 px) e no desktop.
 */
const CELULAR = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function abrirPrimeiro(page: Page, lista: "/vagas" | "/servicos") {
  await page.goto(lista);
  await page.locator(`a[href^="${lista}/"]`).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const barra = (page: Page) => page.locator("[data-barra-de-acao]");
const navegacao = (page: Page) =>
  page.getByRole("navigation", { name: "Navegação principal" });

async function caixa(alvo: ReturnType<typeof barra>) {
  const c = await alvo.boundingBox();
  if (!c) throw new Error("elemento sem caixa na tela");
  return c;
}

async function irParaOFim(page: Page) {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(300);
}

const posicao = (page: Page) =>
  barra(page).evaluate((e) => getComputedStyle(e).position);

test.describe("vaga, celular", () => {
  test.use({ viewport: CELULAR });

  test("o botão está na primeira tela, encostado na navegação inferior", async ({
    page,
  }) => {
    await abrirPrimeiro(page, "/vagas");

    const b = await caixa(barra(page));
    const nav = await caixa(navegacao(page));
    expect(b.y).toBeGreaterThan(0);
    // A base da barra é o topo da navegação: sem vão e sem sobreposição.
    expect(Math.abs(b.y + b.height - nav.y)).toBeLessThanOrEqual(1);

    const botao = await caixa(
      page.getByRole("button", { name: /Candidatar-se/ }),
    );
    expect(botao.y + botao.height).toBeLessThanOrEqual(nav.y);
  });

  test("a navegação tem a altura do token que a barra usa", async ({
    page,
  }) => {
    await abrirPrimeiro(page, "/vagas");

    const alturas = await page.evaluate(() => {
      const nav = document.querySelector(
        'nav[aria-label="Navegação principal"]',
      );
      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return {
        conteudo: nav?.querySelector("ul")?.getBoundingClientRect().height,
        token: 3.75 * rem,
        total: nav?.getBoundingClientRect().height,
      };
    });
    expect(alturas.conteudo).toBe(alturas.token);
    // O total é o conteúdo mais a borda de 1 px: é o que a barra soma.
    expect(alturas.total).toBe(alturas.token + 1);
  });

  test("ao chegar ao fim, a barra assenta antes das vagas parecidas", async ({
    page,
  }) => {
    await abrirPrimeiro(page, "/vagas");
    await irParaOFim(page);

    const b = await caixa(barra(page));
    const parecidas = await caixa(
      page.getByRole("heading", { name: "Vagas parecidas" }),
    );
    expect(b.y + b.height).toBeLessThanOrEqual(parecidas.y + 1);
  });

  test("quando a candidatura termina, a barra solta", async ({ page }) => {
    await abrirPrimeiro(page, "/vagas");
    expect(await posicao(page)).toBe("sticky");

    // Sem candidatar de verdade: o estado de demonstração é compartilhado
    // entre os testes. Só se simula o aviso que o botão dá ao terminar.
    await barra(page).evaluate((e) => {
      const marca = document.createElement("span");
      marca.setAttribute("data-acao-concluida", "");
      e.append(marca);
    });
    expect(await posicao(page)).toBe("static");
  });
});

test.describe("vaga, desktop", () => {
  test.use({ viewport: DESKTOP });

  test("o botão aparece na primeira janela, no cartão da coluna da direita", async ({
    page,
  }) => {
    await abrirPrimeiro(page, "/vagas");

    const botao = await caixa(
      page.getByRole("button", { name: /Candidatar-se/ }),
    );
    expect(botao.y + botao.height).toBeLessThanOrEqual(DESKTOP.height);

    // No computador (#525) a página tem duas colunas: a barra deixa de ser
    // presa ao pé da janela e vira o cartão da coluna da direita, que fica
    // embaixo do cabeçalho. Quem a prende é a coluna, e não a barra.
    expect(await posicao(page)).toBe("static");
    const b = await caixa(barra(page));
    expect(b.x).toBeGreaterThan(DESKTOP.width / 2);
    expect(b.y).toBeLessThan(DESKTOP.height / 2);
  });
});

test.describe("profissional, celular", () => {
  test.use({ viewport: CELULAR });

  test("o contato está na primeira tela, encostado na navegação", async ({
    page,
  }) => {
    await abrirPrimeiro(page, "/servicos");

    const b = await caixa(barra(page));
    const nav = await caixa(navegacao(page));
    expect(Math.abs(b.y + b.height - nav.y)).toBeLessThanOrEqual(1);
  });

  test("acompanha a leitura das avaliações e assenta no fim delas", async ({
    page,
  }) => {
    await abrirPrimeiro(page, "/servicos");
    const nav = await caixa(navegacao(page));

    // Dentro das avaliações a barra continua à vista, colada na navegação.
    await page
      .getByRole("heading", { name: "Avaliações" })
      .scrollIntoViewIfNeeded();
    const dentro = await caixa(barra(page));
    expect(dentro.y).toBeGreaterThanOrEqual(0);
    expect(Math.abs(dentro.y + dentro.height - nav.y)).toBeLessThanOrEqual(1);

    // No fim, ela assenta antes de "Outros profissionais".
    await irParaOFim(page);
    const fim = await caixa(barra(page));
    const outros = await caixa(page.getByRole("heading", { name: /^Outros / }));
    expect(fim.y + fim.height).toBeLessThanOrEqual(outros.y + 1);
  });

  test("com o teclado aberto num campo, a barra sai da frente (aparelho de toque)", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "mobile",
      "só o projeto de celular tem ponteiro de toque",
    );
    await abrirPrimeiro(page, "/servicos");

    const campo = page.getByLabel(/Como foi o serviço/);
    await campo.scrollIntoViewIfNeeded();
    await campo.focus();
    expect(
      await barra(page).evaluate((e) => getComputedStyle(e).visibility),
    ).toBe("hidden");

    await campo.blur();
    expect(
      await barra(page).evaluate((e) => getComputedStyle(e).visibility),
    ).toBe("visible");
  });
});
