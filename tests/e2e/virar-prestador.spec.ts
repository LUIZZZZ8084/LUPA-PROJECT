import { expect, type Page, test } from "@playwright/test";
import { cpfDeTeste, entrarComoTeste } from "./helpers";

/**
 * Virar prestador, no navegador.
 *
 * O card "Oferecer serviço" da home mandava para a tela de **criar conta**,
 * com e-mail e senha do zero — para quem já estava logado, porque ninguém
 * vê aquela home sem sessão. O que se confere aqui é o caminho inteiro: o
 * card leva para a ativação, o aviso do que se perde aparece antes do
 * formulário, e a troca de papel vale de verdade depois.
 *
 * **Uma conta só para o arquivo inteiro, e uma página só.**
 *
 * Duas razões, e as duas já custaram vermelho aqui. A primeira é o limite
 * de cadastro por origem — 5 em 15 minutos, proteção de verdade contra
 * criação de conta em massa: um `entrarComoTeste` por teste estoura no meio
 * da execução, e quem falha é o teste seguinte, não o que mede. A segunda é
 * que esta é uma máquina de estado de mão única: a conta começa candidata e
 * termina prestadora, então os passos precisam correr na ordem, na mesma
 * sessão.
 */
test.describe.configure({ mode: "serial" });

test.describe("virar prestador", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: undefined });
    page = await contexto.newPage();
    await entrarComoTeste(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("o card da home leva para a ativação, não para o cadastro", async () => {
    await page.goto("/");

    const card = page.getByRole("link", { name: /oferecer serviço/i });
    await expect(card).toBeVisible();

    /*
     * O destino é o bug inteiro: `/cadastro?tipo=prestador_servico` pedia
     * conta nova a quem já tinha uma.
     */
    await expect(card).toHaveAttribute("href", "/perfil/virar-prestador");
  });

  test("avisa o que se perde antes de pedir qualquer dado", async () => {
    await page.goto("/perfil/virar-prestador");

    const aviso = page.getByText(/deixa de se candidatar a vagas/i);
    await expect(aviso).toBeVisible();

    // O aviso vem antes do formulário, não depois do botão.
    const posicaoAviso = await aviso.boundingBox();
    const posicaoBotao = await page
      .getByRole("button", { name: /virar prestador/i })
      .boundingBox();

    expect(posicaoAviso?.y ?? 0).toBeLessThan(posicaoBotao?.y ?? 0);

    // E diz o que sobrevive à troca, não só o que acaba.
    await expect(page.getByText(/continuam visíveis/i)).toBeVisible();
  });

  test("recusa CPF inválido sem trocar papel nenhum", async () => {
    await page.goto("/perfil/virar-prestador");

    await page.getByLabel("CPF").fill("111.111.111-11");
    await page.getByLabel("Categoria do serviço").selectOption({ index: 1 });
    await page
      .getByLabel("Sobre o seu trabalho")
      .fill("Instalações elétricas residenciais e comerciais em Sinop.");
    await page.getByRole("button", { name: /virar prestador/i }).click();

    await expect(page.getByText(/CPF inválido/i)).toBeVisible();

    // Continua na tela — quem não pode ativar não ativou.
    await expect(page).toHaveURL(/virar-prestador/);
  });

  test("ativa, troca o papel, e a interface acompanha", async () => {
    await page.goto("/perfil/virar-prestador");

    await page.getByLabel("CPF").fill(cpfDeTeste());
    await page.getByLabel("Categoria do serviço").selectOption({ index: 1 });
    await page
      .getByLabel("Sobre o seu trabalho")
      .fill(
        "Instalações elétricas residenciais e comerciais, manutenção e reparos. Atendo Sinop e região.",
      );

    await page.getByRole("button", { name: /virar prestador/i }).click();

    await page.waitForURL(/\/perfil$/, { timeout: 15_000 });
  });

  /**
   * O que a tela prometeu tem que valer.
   *
   * Este é o teste que pega uma implementação que gravou o perfil e
   * esqueceu de reemitir a sessão: o papel viaja dentro do JWT, e o cookie
   * antigo continuaria dizendo "candidato" por até sete dias.
   */
  test("o botão de candidatar-se some das vagas", async () => {
    await page.goto("/vagas/job-operador-maquinas");

    await expect(
      page.getByRole("button", { name: /candidatar-se/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/não se candidatam a vagas/i)).toBeVisible();
  });

  /** O histórico sobrevive — foi o que o aviso prometeu. */
  test("as candidaturas antigas continuam alcançáveis", async () => {
    const resposta = await page.goto("/perfil/candidaturas");
    expect(resposta?.status()).toBe(200);
  });

  /**
   * Voltar à tela de ativação leva ao perfil, não a um 404.
   *
   * Parece conforto e não é: a action revalida o layout, o que
   * re-renderiza essa mesma rota. Com `notFound()` ali, quem ativava com
   * sucesso terminava olhando para "Não encontramos essa página" — foi o
   * que a primeira versão fez, e o que este teste pegou.
   */
  test("quem já é prestador é levado ao perfil, não a um 404", async () => {
    const resposta = await page.goto("/perfil/virar-prestador");

    expect(resposta?.status()).toBe(200);
    await expect(page).toHaveURL(/\/perfil$/);
  });
});
