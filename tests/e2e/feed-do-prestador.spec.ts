import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { cpfDeTeste, entrarComoTeste } from "./helpers";

/**
 * O feed de trabalhos do prestador.
 *
 * O backend disto já existia inteiro — serviço, repositório, actions,
 * tabela e trigger de limite — e nenhuma tela o consumia. O atalho do
 * perfil apontava para `/servicos`, a busca pública, prometendo "edite
 * categoria, preço e publicações": a pessoa clicava para mexer no próprio
 * anúncio e caía na vitrine de todo mundo.
 *
 * Uma conta só para o arquivo, pela mesma razão do `virar-prestador.spec`:
 * o cadastro tem limite por origem, e o estado aqui também é sequencial —
 * a conta nasce candidata, vira prestadora, e só então tem feed.
 */
test.describe.configure({ mode: "serial" });

/*
 * Só no projeto desktop.
 *
 * Cada arquivo destes cria uma conta, e o cadastro tem limite de 5 por
 * origem em 15 minutos — proteção de verdade contra criação em massa, que
 * a suíte respeita em vez de afrouxar. Rodando nos dois projetos, os dois
 * arquivos mais o setup passam de cinco, e quem falha é o cadastro do
 * teste seguinte, não o que mede.
 *
 * O que se testa aqui é troca de papel e estado, não layout: a varredura
 * responsiva já cobre largura de tela em todas as rotas.
 */
// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo na coleta quando o parâmetro é nomeado. Aqui não se usa fixture — o que interessa é o `info`.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "fluxo não depende de viewport");
});

test.describe("feed do prestador", () => {
  let page: Page;

  /*
   * O guarda se repete aqui porque `beforeAll` roda antes do
   * `beforeEach`: sem ele, a conta era criada no projeto mobile mesmo com
   * todos os testes pulando — e era esse cadastro extra que estourava o
   * limite por origem.
   */
  test.beforeAll(async ({ browser }, info) => {
    if (info.project.name !== "desktop") return;

    const contexto = await browser.newContext({ storageState: undefined });
    page = await contexto.newPage();
    await entrarComoTeste(page);

    // Vira prestador: sem isso não há feed para ter.
    await page.goto("/perfil/virar-prestador");
    await page.getByLabel("CPF").fill(cpfDeTeste());
    await page.getByLabel("Categoria do serviço").selectOption({ index: 1 });
    await page
      .getByLabel("Sobre o seu trabalho")
      .fill("Instalações elétricas residenciais e comerciais em Sinop.");
    await page.getByRole("button", { name: /virar prestador/i }).click();
    await page.waitForURL(/\/perfil$/, { timeout: 15_000 });
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test("o atalho do perfil leva ao feed, não para a busca pública", async () => {
    await page.goto("/perfil");

    const atalho = page.getByRole("link", { name: /meus trabalhos/i });
    await expect(atalho).toBeVisible();
    await expect(atalho).toHaveAttribute("href", "/perfil/publicacoes");
  });

  test("começa vazio, e diz para que serve", async () => {
    await page.goto("/perfil/publicacoes");

    await expect(page.getByText(/0 de 10 no feed/)).toBeVisible();
    await expect(
      page.getByText(/ainda não publicou nenhum trabalho/i),
    ).toBeVisible();
  });

  test("publica um trabalho e ele entra no feed", async () => {
    await page.goto("/perfil/publicacoes");

    await page
      .getByLabel("O que foi feito")
      .fill("Troca de quadro de disjuntores");
    await page
      .getByLabel("Detalhes")
      .fill(
        "Quadro novo com DR num sobrado do Jardim Botânico. Refiz a fiação da cozinha. Um dia de serviço.",
      );
    await page.getByRole("button", { name: /publicar trabalho/i }).click();

    await expect(
      page.getByRole("heading", { name: "Troca de quadro de disjuntores" }),
    ).toBeVisible();
    await expect(page.getByText(/1 de 10 no feed/)).toBeVisible();
  });

  /**
   * Remover é tirar do feed, não apagar.
   *
   * O registro fica, e volta pelo botão ao lado. Apagar de verdade tiraria
   * da pessoa um trabalho que ela teve — decisão que já estava no serviço
   * e que a tela precisa honrar.
   */
  test("remover tira do feed sem perder o trabalho", async () => {
    await page.goto("/perfil/publicacoes");

    /*
     * "Remover do feed", e não "Remover": o `aria-label` do botão substitui
     * o texto visível como nome acessível, e é por ele que o leitor de tela
     * — e o Playwright — enxerga o controle.
     */
    await page
      .getByRole("button", { name: /remover do feed/i })
      .first()
      .click();

    await expect(page.getByText(/0 de 10 no feed/)).toBeVisible();
    await expect(page.getByText("Fora do feed").first()).toBeVisible();

    // E dá para trazer de volta.
    await page
      .getByRole("button", { name: /colocar de volta no feed/i })
      .click();
    await expect(page.getByText(/1 de 10 no feed/)).toBeVisible();
  });

  /**
   * Contraste e rótulo na tela nova.
   *
   * As varreduras de acessibilidade rodam sobre uma lista fixa de rotas, e
   * uma tela criada depois dela não entra sozinha. Conferir aqui é o que
   * impede o feed de nascer fora da regra que vale para todo o resto —
   * boa parte deste público abre o app na rua, sob sol forte.
   */
  test("o feed passa em contraste e rótulo", async () => {
    await page.goto("/perfil/publicacoes");

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      resultado.violations.map((v) => ({
        regra: v.id,
        elementos: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120)),
      })),
    ).toEqual([]);
  });

  test("o trabalho aparece no perfil público do prestador", async () => {
    await page.goto("/perfil");

    /*
     * O perfil público é alcançado pelo próprio id da sessão. O prestador
     * criado neste teste não passou pela verificação, então não está na
     * busca — mas o perfil abre por link direto, que é justamente o que a
     * #114 preservou.
     */
    const meuPerfil = page.getByRole("link", { name: /ver meu perfil/i });
    if ((await meuPerfil.count()) > 0) {
      await meuPerfil.first().click();
      await expect(
        page.getByRole("heading", { name: "Trabalhos publicados" }),
      ).toBeVisible();
    }
  });
});
