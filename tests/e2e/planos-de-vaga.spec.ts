import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  aguardarAnimacoes,
  aguardarHidratacao,
  cnpjDeTeste,
  escolherCidade,
  SENHA_DE_TESTE,
} from "./helpers";

/**
 * Os planos de vaga, do ponto de vista de quem contrata (#489).
 *
 * A conta compartilhada da suíte assina o ilimitado no setup, para os outros
 * testes publicarem sem teto. Esta spec usa uma conta própria, porque o que
 * se mede aqui é justamente o que o ilimitado esconde: o plano com teto, o
 * cancelamento da renovação e a troca para o plano maior.
 *
 * O teto em si — a sexta vaga do Plano 5 — é medido nos testes unitários
 * (`carteira-de-vagas.test.ts`, `vagas.test.ts`): chegar nele pelo navegador
 * exigiria publicar cinco vagas de verdade.
 */
/**
 * Contraste dos estados que a varredura das rotas não vê: ela abre
 * `/empresa/creditos` com a conta compartilhada, que tem o ilimitado, e
 * nunca com um plano de limite, com o selo "Seu plano" ou com a confirmação
 * do cancelamento aberta.
 */
async function semViolacoes(page: Page) {
  await aguardarAnimacoes(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
}

test.describe("planos de vaga", () => {
  test.use({
    storageState: { cookies: [], origins: [] },
    // Origem própria: o limite de cadastro é por origem e não tem
    // multiplicador, igual aos outros testes de cadastro.
    extraHTTPHeaders: { "x-forwarded-for": "203.0.113.96" },
  });

  test("assina, vê o plano, cancela a renovação e troca para o maior", async ({
    page,
  }) => {
    await page.goto("/cadastro?tipo=empresa");
    await aguardarHidratacao(page, "form");

    await page.getByLabel("Nome do responsável").fill("Responsável de Teste");
    await page.getByLabel("Nome da empresa").fill("Empresa dos Planos Ltda");
    await page.getByLabel("CNPJ").fill(cnpjDeTeste());
    await page.getByLabel("E-mail").fill(`e2e-planos-${Date.now()}@teste.lupa`);
    await page.getByLabel("WhatsApp").fill("66999999999");
    await escolherCidade(page);
    await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
    await page.getByRole("button", { name: /criar conta/i }).click();
    await expect(page.getByText(/Conta criada/i)).toBeVisible({
      timeout: 15_000,
    });

    // Sem plano e sem saldo: a tela diz isso antes dos preços.
    await page.goto("/empresa/creditos");
    await expect(
      page.getByText("Você não tem vagas para publicar"),
    ).toBeVisible();

    // Os três planos e a avulsa, com o preço da tabela.
    await expect(page.getByRole("heading", { name: "Plano 5" })).toBeVisible();
    await expect(page.getByText("R$ 49,90").first()).toBeVisible();
    await expect(page.getByText("R$ 79,90").first()).toBeVisible();
    await expect(page.getByText("R$ 99,90").first()).toBeVisible();
    await expect(page.getByText("R$ 19,90").first()).toBeVisible();
    await expect(page.getByText(/até 5 vagas no ar/i)).toBeVisible();

    // A vaga avulsa vem primeiro (#501): quem tem uma vaga só não rola por
    // três planos mensais para achar a opção dela.
    const titulos = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(titulos.indexOf("1 vaga")).toBeGreaterThanOrEqual(0);
    expect(titulos.indexOf("1 vaga")).toBeLessThan(titulos.indexOf("Plano 5"));

    /*
     * O ponto aceso segue a rolagem, medida no navegador de verdade (#503). O
     * teste unitário cobre a conta com medidas inventadas, e foi um navegador
     * que mostrou o ponto errado quando a faixa não era o `offsetParent` dos
     * cards. Rola até o fim por script, que é o que o dedo faz.
     */
    const pontos = page.locator("[data-ativo]");
    await expect(pontos).toHaveCount(4);
    // No computador (#525) as opções cabem numa grade e não há o que rolar;
    // a rolagem só existe onde a faixa é mais larga que a janela.
    const faixa = page.getByRole("list", { name: "Opções de vaga e plano" });
    const rola = await faixa.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    );
    if (rola) {
      await expect(pontos.nth(0)).toHaveAttribute("data-ativo", "true");
      await faixa.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expect(pontos.nth(3)).toHaveAttribute("data-ativo", "true");
      await faixa.evaluate((el) => {
        el.scrollLeft = 0;
      });
      await expect(pontos.nth(0)).toHaveAttribute("data-ativo", "true");
    }

    // Assina o Plano 5.
    await page.getByRole("button", { name: /assinar plano 5/i }).click();
    await page.waitForURL(/\/pagamento\/retorno/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Pagamento aprovado" }),
    ).toBeVisible({ timeout: 30_000 });

    // O plano aparece com o limite, e não oferece assinar outro por cima:
    // o botão que só recusa depois do clique não existe.
    await page.goto("/empresa/creditos");
    await expect(page.getByText("Plano de 5: 0 no ar")).toBeVisible();
    await expect(page.getByText("Seu plano", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /assinar plano 10/i }),
    ).toHaveCount(0);
    await semViolacoes(page);

    // O formulário de publicar diz o mesmo antes dos campos.
    await page.goto("/empresa/vagas/nova");
    await expect(page.getByText("Plano de 5: 0 no ar")).toBeVisible();
    await expect(page.getByText(/cabem mais 5 vagas/i)).toBeVisible();

    // Cancela a renovação: pede confirmação e diz que os dias pagos ficam.
    await page.goto("/empresa/creditos");
    await page.getByRole("button", { name: /cancelar renovação/i }).click();
    await expect(page.getByText(/nada é devolvido/i)).toBeVisible();
    await semViolacoes(page);
    await page.getByRole("button", { name: /confirmar cancelamento/i }).click();

    // O plano continua valendo até o fim do período, mas não renova, e as
    // opções de plano voltam para quem quer trocar.
    await expect(page.getByText(/e não renova mais/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Plano de 5: 0 no ar")).toBeVisible();

    // Assina o Plano 10, e o limite novo vale na hora.
    await page.getByRole("button", { name: /assinar plano 10/i }).click();
    await page.waitForURL(/\/pagamento\/retorno/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: "Pagamento aprovado" }),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/empresa/creditos");
    await expect(page.getByText("Plano de 10: 0 no ar")).toBeVisible();
  });
});
