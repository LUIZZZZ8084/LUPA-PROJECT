import { expect, test } from "@playwright/test";
import {
  aguardarHidratacao,
  cnpjDeTeste,
  escolherCidade,
  SENHA_DE_TESTE,
} from "./helpers";

/**
 * A tela que aparece logo depois de criar uma conta de empresa (#299).
 *
 * Ela mostrava quatro preços antes da opção grátis, e quem acabava de se
 * cadastrar entendia que o app já estava cobrando. O que se trava aqui é o
 * que foi reclamado, medido no navegador: o grátis vem antes de qualquer
 * compra, a confirmação diz que nada foi cobrado, e tudo cabe num celular
 * comum sem rolar.
 */
test.describe("plano depois do cadastro da empresa", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    // Origem própria: o limite de cadastro é por origem e não tem
    // multiplicador, igual aos outros testes de cadastro.
    extraHTTPHeaders: { "x-forwarded-for": "203.0.113.93" },
    viewport: { width: 390, height: 844 },
  });

  test("o grátis vem primeiro, nada foi cobrado, e cabe sem rolar", async ({
    page,
  }) => {
    await page.goto("/cadastro?tipo=empresa");
    await aguardarHidratacao(page, "form");

    await page.getByLabel("Nome do responsável").fill("Responsável de Teste");
    await page.getByLabel("Nome da empresa").fill("Empresa do Plano Ltda");
    await page.getByLabel("CNPJ").fill(cnpjDeTeste());
    await page.getByLabel("E-mail").fill(`e2e-plano-${Date.now()}@teste.lupa`);
    await page.getByLabel("WhatsApp").fill("66999999999");
    await escolherCidade(page);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/Conta criada/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/nada foi cobrado/i)).toBeVisible();

    // O título do formulário não sobrevive à conta criada.
    await expect(page.getByText(/leva menos de dois minutos/i)).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 0));

    const gratis = page.getByRole("link", { name: /continuar grátis/i });
    const primeiraCompra = page.getByRole("button", {
      name: /comprar 1 vaga/i,
    });
    const ultimaCompra = page.getByRole("button", {
      name: /assinar o plano mensal/i,
    });

    const caixaGratis = await gratis.boundingBox();
    const caixaPrimeira = await primeiraCompra.boundingBox();
    const caixaUltima = await ultimaCompra.boundingBox();
    if (!caixaGratis || !caixaPrimeira || !caixaUltima) {
      throw new Error("um dos botões não foi renderizado");
    }

    expect(caixaGratis.y, "o grátis devia vir antes da primeira compra").toBe(
      Math.min(caixaGratis.y, caixaPrimeira.y),
    );

    const altura = page.viewportSize()?.height ?? 844;
    expect(
      caixaUltima.y + caixaUltima.height,
      "a última opção ficou abaixo da dobra — a tela pede rolagem",
    ).toBeLessThanOrEqual(altura);
  });
});
