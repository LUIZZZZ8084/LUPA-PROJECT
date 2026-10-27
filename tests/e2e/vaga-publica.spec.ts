import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
  aguardarHidratacao,
  cpfDeTeste,
  emailDaConta,
  escolherCidade,
  SENHA_DE_TESTE,
} from "./helpers";

/**
 * A vaga abre sem login, só para leitura (#490).
 *
 * A empresa cola o link no WhatsApp ou posta no Instagram, e quem clica caía
 * numa tela de entrar — assim como o robô que monta a prévia. O que só o
 * navegador prova: a página responde 200 sem sessão, não traz contato nenhum,
 * a prévia tem título, descrição e uma imagem que de fato abre, e entrar ou
 * criar conta leva de volta à mesma vaga.
 *
 * A vaga é a de exemplo da demonstração. Vaga encerrada e a visão do dono
 * estão nos testes de componente (`pagina-da-vaga-publica.test.tsx`): mudar o
 * estado da demonstração aqui afetaria os outros specs, que compartilham o
 * servidor.
 */
const VAGA = "/vagas/job-operador-maquinas";

test.describe("vaga pública", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("abre sem login, com a vaga e sem nenhum contato", async ({ page }) => {
    const resposta = await page.goto(VAGA);

    expect(resposta?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(VAGA);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Operador",
    );

    // O conteúdo da vaga: o rodapé do app tem o e-mail de suporte da Lupa, e
    // isso não é contato da empresa.
    const html = await page.locator("main").innerHTML();
    expect(html, "WhatsApp na vaga pública").not.toMatch(/wa\.me/);
    expect(html, "telefone na vaga pública").not.toMatch(/href="tel:/);
    expect(html, "e-mail na vaga pública").not.toMatch(/href="mailto:/);
    await expect(
      page.locator("main").getByRole("link", { name: "Instagram" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /denunciar/i })).toHaveCount(
      0,
    );
  });

  /**
   * A varredura das rotas abre a vaga com sessão, e a tela sem conta tem
   * outro rodapé: o convite para entrar, preso no pé da janela. Contraste nos
   * dois temas, pelo mesmo motivo de sempre — texto sobre fundo tingido.
   */
  for (const esquema of ["light", "dark"] as const) {
    test(`sem conta, passa no contraste no tema ${esquema}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: esquema });
      await page.goto(VAGA);
      await aguardarAnimacoes(page);

      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(violations.map((v) => v.id)).toEqual([]);
    });
  }

  test("a lista de vagas continua pedindo login", async ({ page }) => {
    await page.goto("/vagas");

    expect(new URL(page.url()).pathname).toBe("/entrar");
  });

  /**
   * O que o WhatsApp, o Instagram e o Facebook leem. A imagem é buscada por
   * um servidor sem sessão: se o muro a barrasse, a prévia sairia sem
   * miniatura e ninguém veria por quê.
   */
  test("a prévia tem título, descrição e uma imagem que abre sem login", async ({
    page,
    request,
  }) => {
    await page.goto(VAGA);

    const meta = (propriedade: string) =>
      page.locator(`meta[property="${propriedade}"]`).getAttribute("content");

    expect(await meta("og:title")).toContain("Operador");
    expect(await meta("og:description")).toBeTruthy();
    expect(await meta("og:site_name")).toBe("Lupa");

    const imagem = await meta("og:image");
    expect(imagem, "a vaga tem miniatura própria").toMatch(
      /\/vagas\/job-operador-maquinas\/opengraph-image/,
    );

    const resposta = await request.get(new URL(imagem ?? "").pathname, {
      maxRedirects: 0,
    });
    expect(resposta.status(), "a miniatura precisa abrir sem sessão").toBe(200);
    expect(resposta.headers()["content-type"]).toBe("image/png");
  });

  test("candidatar-se pede entrar, e entrar volta para a mesma vaga", async ({
    page,
  }) => {
    await page.goto(VAGA);
    await expect(
      page.getByRole("button", { name: /candidatar-se/i }),
    ).toHaveCount(0);

    await page
      .getByRole("link", { name: /entrar para se candidatar/i })
      .click();
    await page.waitForURL(/\/entrar\?destino=/);
    await aguardarHidratacao(page, "form");

    await page.getByLabel("E-mail").fill(emailDaConta("candidato"));
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: "Entrar" }).click();

    await page.waitForURL(`**${VAGA}`, { timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /candidatar-se/i }),
    ).toBeVisible();
  });
});

test.describe("criar conta a partir da vaga", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    // Origem própria: o limite de cadastro é por origem e não tem
    // multiplicador, igual aos outros testes de cadastro.
    extraHTTPHeaders: { "x-forwarded-for": "203.0.113.97" },
  });

  test("a conta nova volta para a vaga de onde veio", async ({ page }) => {
    await page.goto(VAGA);
    await page.getByRole("link", { name: /criar conta grátis/i }).click();
    await page.waitForURL(/\/cadastro\?tipo=candidato_clt&destino=/);
    await aguardarHidratacao(page, "form");

    await page.getByLabel("Nome completo").fill("Pessoa da Vaga");
    await page.getByLabel("E-mail").fill(`e2e-vaga-${Date.now()}@teste.lupa`);
    await page.getByLabel("WhatsApp").fill("66999999999");
    await page.getByLabel("CPF").fill(cpfDeTeste());
    await page.getByLabel("Área desejada").selectOption({ index: 1 });
    await escolherCidade(page);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/Conta criada/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: /voltar para a vaga/i }).click();

    await page.waitForURL(`**${VAGA}`);
    await expect(
      page.getByRole("button", { name: /candidatar-se/i }),
    ).toBeVisible();
  });

  /**
   * O destino vem da URL, e a URL vem de fora (#345). Um endereço de outro
   * site não pode virar o botão "Voltar para a vaga".
   */
  test("um destino de outro site não vira link", async ({ page }) => {
    await page.goto(
      `/cadastro?tipo=candidato_clt&destino=${encodeURIComponent("https://exemplo-externo.invalid/roubar")}`,
    );
    await aguardarHidratacao(page, "form");

    await page.getByLabel("Nome completo").fill("Pessoa da Vaga");
    await page
      .getByLabel("E-mail")
      .fill(`e2e-vaga-fora-${Date.now()}@teste.lupa`);
    await page.getByLabel("WhatsApp").fill("66999999999");
    await page.getByLabel("CPF").fill(cpfDeTeste());
    await page.getByLabel("Área desejada").selectOption({ index: 1 });
    await escolherCidade(page);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/Conta criada/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("link", { name: /voltar para a vaga/i }),
    ).toHaveCount(0);
  });
});

test.describe("compartilhar, para a empresa dona", () => {
  test("a empresa vê a divulgação na vaga e baixa a arte", async ({
    browser,
  }) => {
    // A conta compartilhada da empresa, via o arquivo de sessão do setup.
    const contexto = await browser.newContext({
      storageState: ARQUIVO_SESSAO_EMPRESA,
    });
    const page = await contexto.newPage();

    // Em demonstração toda conta de contratante é a empresa fictícia, dona
    // das vagas de exemplo.
    await page.goto(VAGA);
    await expect(page.getByText(/divulgue esta vaga/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /enviar no whatsapp/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /copiar link/i }),
    ).toBeVisible();

    // `fetch` do próprio navegador: o cookie de sessão é `Secure`, e o
    // cliente HTTP do Playwright não o envia para `http://localhost`.
    const arte = await page.evaluate(async () => {
      const r = await fetch("/api/vagas/job-operador-maquinas/arte");
      return {
        status: r.status,
        tipo: r.headers.get("content-type"),
        disposicao: r.headers.get("content-disposition"),
      };
    });
    expect(arte.status).toBe(200);
    expect(arte.tipo).toBe("image/png");
    expect(arte.disposicao).toContain("attachment");

    await contexto.close();
  });
});
