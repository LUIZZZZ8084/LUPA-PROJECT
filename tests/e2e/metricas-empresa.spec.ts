import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * As métricas do painel da empresa, conferidas no navegador.
 *
 * Existe porque a primeira conferência desta funcionalidade foi feita lendo
 * o DOM de uma aba oculta, e ali o React 19 nunca revela o conteúdo do
 * Suspense: a revelação espera um quadro de animação, e aba escondida não
 * pinta quadro. A conclusão foi "o painel está vazio" — e não estava.
 * Confirmar no navegador de verdade, pelo caminho que o usuário percorre, é
 * a única leitura que vale.
 */
test.describe("métricas do painel da empresa", () => {
  /*
   * Sessão de empresa, e não a compartilhada.
   *
   * Estes testes abrem `/empresa`. Até a #104 isso funcionava com a sessão
   * de candidato — não porque o teste estivesse certo, mas porque a página
   * não conferia o papel. Fechado o portão, a sessão certa passou a ser
   * exigência, e é o que o teste devia estar usando desde sempre.
   */
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("mostra as duas séries e diz o que a visualização conta", async ({
    page,
  }) => {
    await page.goto("/empresa");

    await expect(
      page.getByRole("heading", { name: "Minha Empresa" }),
    ).toBeVisible();

    await expect(page.getByText("Visualizações por dia")).toBeVisible();
    await expect(page.getByText("Candidaturas por dia")).toBeVisible();

    /*
     * O aviso não é enfeite: visualização conta recarga, então o número
     * mede tendência, não público. Sem a frase, a empresa lê como
     * "pessoas diferentes" e decide preço de anúncio em cima disso.
     */
    await expect(page.getByText(/conta cada abertura da vaga/i)).toBeVisible();
  });

  test("a série tem os 30 dias, também para leitor de tela", async ({
    page,
  }) => {
    await page.goto("/empresa");

    const lista = page.locator("ul.sr-only", {
      hasText: /movimento diário das suas vagas/i,
    });

    // 30 dias + o item que apresenta a lista.
    await expect(lista.locator("li")).toHaveCount(31);
  });

  /**
   * O número era `MOCK_COMPANY_STATS.views`: 1.245 fixos, iguais com o
   * banco ligado ou desligado. Este teste trava o total no que a série
   * soma — se voltarem a chumbar um número, os dois deixam de bater.
   */
  test("o total de visualizações é a soma da série, não um número fixo", async ({
    page,
  }) => {
    await page.goto("/empresa");

    const somaDaLista = await page.evaluate(() => {
      const itens = [...document.querySelectorAll("ul.sr-only li")];
      return itens.reduce((total, item) => {
        const n = /: (\d+) visualiza/.exec(item.textContent ?? "");
        return total + (n ? Number(n[1]) : 0);
      }, 0);
    });

    expect(somaDaLista).toBeGreaterThan(0);
    expect(somaDaLista).not.toBe(1245);

    const cartao = page
      .getByText("Visualizações (30 dias)")
      .locator("xpath=preceding-sibling::div[1]");

    await expect(cartao).toHaveText(somaDaLista.toLocaleString("pt-BR"));
  });
});
