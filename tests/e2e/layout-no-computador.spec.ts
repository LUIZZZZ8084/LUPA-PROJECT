import { expect, type Page, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * O app no computador (#525).
 *
 * Foi desenhado para o celular: no monitor o conteúdo ficava numa coluna de
 * 672 a 896 px no meio de uma tela vazia, mais estreita que o cabeçalho
 * acima dela (as bordas não alinhavam), e as páginas de detalhe empilhavam
 * tudo como no celular. A partir de `lg` (1024 px) o cabeçalho, o conteúdo e o
 * rodapé usam a mesma largura, as listas ganham colunas, vaga e profissional
 * ficam em duas colunas com a ação presa ao lado, e entrar e criar conta têm
 * um painel de apresentação.
 *
 * **Abaixo de `lg` nada muda**, e os testes do fim travam isso: uma classe sem
 * o prefixo `lg:` aparece aqui como o painel visível no tablet.
 */
const SEM_SESSAO = { cookies: [], origins: [] };
const LARGURAS_DE_MONITOR = [1024, 1280, 1440, 1920];
const ALTURA = 900;

test.beforeEach(async ({ page: _page }, info) => {
  // O viewport é controlado dentro de cada teste, como nas outras varreduras.
  test.skip(info.project.name !== "desktop", "só o projeto desktop");
});

async function esquerdaDe(page: Page, seletor: string) {
  const caixa = await page.locator(seletor).first().boundingBox();
  if (!caixa) throw new Error(`sem caixa na tela: ${seletor}`);
  return caixa;
}

const LOGO = 'header a[aria-label="Lupa — início"]';

test.describe("alinhamento", () => {
  for (const largura of LARGURAS_DE_MONITOR) {
    test(`a ${largura} px o conteúdo começa onde o logo do cabeçalho`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura, height: ALTURA });

      // `default` (lista), `colunas` (perfil) e `formulario` (editar perfil).
      for (const rota of ["/vagas", "/perfil", "/perfil/editar"]) {
        await page.goto(rota);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const logo = await esquerdaDe(page, LOGO);
        const titulo = await esquerdaDe(page, "main h1");
        if (rota === "/perfil/editar") {
          // O formulário é mais estreito que o cabeçalho e fica centralizado:
          // o que se exige é que não passe da largura do site.
          const main = await esquerdaDe(page, "main");
          expect(main.x).toBeGreaterThanOrEqual(logo.x - 32 - 1);
          continue;
        }
        expect(
          Math.abs(titulo.x - logo.x),
          `${rota} a ${largura} px`,
        ).toBeLessThan(1.5);
      }
    });

    test(`a ${largura} px a página não rola para o lado`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: ALTURA });
      for (const rota of ["/", "/vagas", "/servicos", "/perfil"]) {
        await page.goto(rota);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const sobra = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(sobra, `${rota} a ${largura} px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("listas", () => {
  async function colunasDaLista(page: Page) {
    return page.evaluate(() => {
      const cartoes = Array.from(
        document.querySelectorAll<HTMLElement>('main a[href^="/vagas/"]'),
      ).filter((a) => a.getBoundingClientRect().width > 150);
      return new Set(
        cartoes.map((c) => Math.round(c.getBoundingClientRect().left)),
      ).size;
    });
  }

  test("a 1440 px as vagas ficam em três colunas", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: ALTURA });
    await page.goto("/vagas");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await colunasDaLista(page)).toBe(3);
  });

  test("a 1024 px continuam duas, que é o que cabe", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: ALTURA });
    await page.goto("/vagas");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await colunasDaLista(page)).toBe(2);
  });
});

test.describe("vaga em duas colunas", () => {
  async function abrirPrimeiraVaga(page: Page) {
    await page.goto("/vagas");
    await page.locator('a[href^="/vagas/"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }

  test("a candidatura fica ao lado da descrição e acompanha a rolagem", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await abrirPrimeiraVaga(page);

    const painel = await esquerdaDe(page, "main section");
    const barra = await esquerdaDe(page, "[data-barra-de-acao]");
    // À direita do painel, e não embaixo dele.
    expect(barra.x).toBeGreaterThanOrEqual(painel.x + painel.width);
    expect(barra.y).toBeLessThan(painel.y + painel.height / 2);

    // O cartão acompanha a leitura: depois de rolar, continua perto do topo.
    const alturaDaPagina = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    test.skip(alturaDaPagina < 700 + 300, "a vaga cabe na janela, sem rolagem");
    await page.evaluate(() => window.scrollTo(0, 250));
    await page.waitForTimeout(250);
    const depois = await esquerdaDe(page, "[data-barra-de-acao]");
    expect(depois.y).toBeGreaterThan(0);
    expect(depois.y).toBeLessThan(160);
  });

  test("a 820 px (tablet) continua uma coluna, com a barra embaixo", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await abrirPrimeiraVaga(page);

    const painel = await esquerdaDe(page, "main section");
    const barra = await esquerdaDe(page, "[data-barra-de-acao]");
    expect(barra.x).toBeLessThan(painel.x + painel.width / 2);
  });
});

test.describe("entrar e criar conta", () => {
  test.use({ storageState: SEM_SESSAO });

  test("a 1280 px há o painel de apresentação ao lado do formulário", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: ALTURA });
    for (const rota of ["/entrar", "/cadastro"]) {
      await page.goto(rota);
      const painel = page.getByRole("complementary", {
        name: "Por que a Lupa",
      });
      await expect(painel).toBeVisible();
      const p = await painel.boundingBox();
      const formulario = await esquerdaDe(page, "main");
      expect(p).not.toBeNull();
      // O formulário está à direita do painel.
      expect(formulario.x).toBeGreaterThanOrEqual(
        (p?.x ?? 0) + (p?.width ?? 0),
      );
    }
  });

  test("a 820 px o painel não existe e o formulário segue sozinho", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: ALTURA });
    await page.goto("/entrar");
    await expect(
      page.getByRole("complementary", { name: "Por que a Lupa" }),
    ).toBeHidden();
    await expect(page.getByLabel("E-mail")).toBeVisible();
  });
});

test.describe("rodapé", () => {
  test("a 1280 px o rodapé está lá, com a linha de direitos uma vez só", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: ALTURA });
    await page.goto("/perfil");
    const rodape = page.getByRole("contentinfo");
    await expect(rodape).toBeVisible();
    await expect(
      rodape.getByText(/Todos os direitos reservados/),
    ).toBeVisible();
    // O que o celular mostra no corpo da página não repete no computador.
    await expect(
      page.getByText(/Todos os direitos reservados/).locator("visible=true"),
    ).toHaveCount(1);
  });

  test("a 820 px não há rodapé", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: ALTURA });
    await page.goto("/perfil");
    await expect(page.getByRole("contentinfo")).toBeHidden();
  });
});

test.describe("planos da empresa", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("a 1440 px as quatro opções estão todas à vista, sem carrossel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: ALTURA });
    await page.goto("/empresa/creditos");
    const lista = page.getByRole("list", { name: "Opções de vaga e plano" });
    await expect(lista).toBeVisible();

    const caixas = await lista.locator("> li").evaluateAll((itens) =>
      itens.map((li) => {
        const r = li.getBoundingClientRect();
        return { x: r.left, direita: r.right };
      }),
    );
    expect(caixas).toHaveLength(4);
    for (const c of caixas) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.direita).toBeLessThanOrEqual(1440);
    }
    // Sem o que rolar, não há setas nem pontos.
    await expect(
      page.getByRole("button", { name: "Próxima opção" }),
    ).toBeHidden();
  });
});
