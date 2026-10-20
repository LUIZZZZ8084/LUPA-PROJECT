import AxeBuilder from "@axe-core/playwright";
import { devices, expect, type Page, test } from "@playwright/test";
import { aguardarAnimacoes } from "./helpers";

/**
 * O convite para instalar, num navegador de verdade (#475).
 *
 * Cada bloco escolhe o aparelho pelo que o navegador diz de si — é o que a
 * Lupa lê para decidir. O Chromium headless não entrega o pedido de
 * instalação de verdade; o teste do Android entrega um no mesmo formato,
 * e ele só chega ao botão se o script do `<head>` rodou — com a CSP de
 * nonce, um script sem assinatura morreria em silêncio e o botão nunca
 * instalaria direto.
 */

// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo na coleta quando o parâmetro é nomeado.
test.beforeEach(({}, info) => {
  info.skip(
    info.project.name !== "desktop",
    "cada bloco escolhe o próprio aparelho; rodar nos dois projetos repetiria tudo",
  );
});

function comoAparelho(nome: "iPhone 13" | "Pixel 7") {
  const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } =
    devices[nome];
  return { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch };
}

const convite = (page: Page) =>
  page.getByRole("region", { name: "Instalar o app" });

/** O tema só troca de rótulo depois que o React assume a página. */
async function aguardarHidratacao(page: Page) {
  await expect(
    page.getByRole("button", { name: /Mudar para o tema/ }),
  ).toBeVisible();
}

test.describe("no iPhone", () => {
  test.use(comoAparelho("iPhone 13"));

  test("o botão mostra os passos, com contraste nos dois temas", async ({
    page,
  }) => {
    await page.goto("/");
    const instalar = convite(page).getByRole("button", { name: "Instalar" });
    await expect(instalar).toBeVisible();

    await instalar.click();
    await expect(instalar).toHaveAttribute("aria-expanded", "true");
    await expect(
      convite(page).getByText("Adicionar à Tela de Início"),
    ).toBeVisible();

    // Os passos só existem depois do clique: a varredura das rotas não os vê.
    for (const tema of ["claro", "escuro"] as const) {
      await page.evaluate((t) => {
        if (t === "escuro") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
      }, tema);
      // O botão anima a troca de cor; medido no meio dela, mente.
      await aguardarAnimacoes(page);
      const { violations } = await new AxeBuilder({ page })
        .include('section[aria-label="Instalar o app"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`),
        `tema ${tema}`,
      ).toEqual([]);
    }
  });

  test("cabe inteiro em 360 px, sem rolagem para o lado", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");
    await convite(page).getByRole("button", { name: "Instalar" }).click();

    for (const nome of ["Instalar", "Agora não"]) {
      await expect(
        convite(page).getByRole("button", { name: nome }),
      ).toBeInViewport({ ratio: 1 });
    }
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test('"Agora não" vale para a visita: trocar de tela não traz de volta, abrir de novo traz', async ({
    page,
  }) => {
    await page.goto("/");
    await convite(page).getByRole("button", { name: "Agora não" }).click();
    await expect(convite(page)).toHaveCount(0);

    // Navegar pela barra de baixo é trocar de tela sem recarregar.
    await page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Vagas" })
      .click();
    await expect(page).toHaveURL(/\/vagas/);
    await aguardarHidratacao(page);
    await expect(convite(page)).toHaveCount(0);

    // Abrir a Lupa de novo é carregar a página do zero.
    await page.goto("/");
    await expect(convite(page)).toBeVisible();
  });
});

test.describe("no Android", () => {
  test.use(comoAparelho("Pixel 7"));

  test("com o pedido do navegador, o toque abre a instalação", async ({
    page,
  }) => {
    await page.goto("/");
    const instalar = convite(page).getByRole("button", { name: "Instalar" });
    // Antes do pedido, o toque mostraria o caminho pelo menu.
    await expect(instalar).toHaveAttribute("aria-expanded", "false");

    await page.evaluate(() => {
      const pedido = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(pedido, {
        prompt: async () => {
          document.documentElement.dataset.pediuInstalacao = "sim";
        },
        userChoice: Promise.resolve({ outcome: "accepted" }),
      });
      window.dispatchEvent(pedido);
    });

    // Com o pedido guardado pelo script do `<head>`, o botão instala direto.
    await expect(instalar).not.toHaveAttribute("aria-expanded");
    await instalar.click();

    await expect(page.locator("html")).toHaveAttribute(
      "data-pediu-instalacao",
      "sim",
    );
    await expect(convite(page)).toHaveCount(0);
  });
});

test("no computador, o convite não aparece", async ({ page }) => {
  await page.goto("/");
  await aguardarHidratacao(page);
  await expect(convite(page)).toHaveCount(0);
});
