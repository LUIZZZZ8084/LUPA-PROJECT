import { expect, type Page, test } from "@playwright/test";
import { entrarComoTeste } from "./helpers";

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

test.describe("virar prestador", () => {
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
  });

  test.afterAll(async () => {
    await page?.context().close();
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

  /*
   * Sem campo de CPF nesta tela: a conta de `entrarComoTeste` já se
   * cadastrou com um. A validação de CPF inválido é coberta no cadastro
   * — em `tests/unit/server/cadastro-login.test.ts` — que é onde o campo
   * mora agora. Esta tela só pede CPF de quem se cadastrou antes de ele
   * virar obrigatório, e não há como chegar a essa conta pela UI pública.
   */
  test("ativa, troca o papel, e a interface acompanha", async () => {
    await page.goto("/perfil/virar-prestador");

    await expect(page.getByLabel("CPF")).toHaveCount(0);

    await page.getByLabel("Categoria do serviço").selectOption({ index: 1 });
    await page
      .getByLabel("Sobre o seu trabalho")
      .fill(
        "Instalações elétricas residenciais e comerciais, manutenção e reparos. Atendo Sinop e região.",
      );

    await page.getByRole("button", { name: /virar prestador/i }).click();

    /*
     * Vai para a assinatura, não para o perfil — desde a #170, virar
     * prestador não dá mais carência sem cartão: sem assinatura o perfil
     * nem aparece na vitrine, e mandar para `/perfil` deixaria a pessoa
     * sem saber que falta um passo.
     */
    await page.waitForURL(/\/perfil\/assinatura$/, { timeout: 15_000 });
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
   * Voltar à tela de ativação leva à assinatura, não a um 404.
   *
   * Parece conforto e não é: a action revalida o layout, o que
   * re-renderiza essa mesma rota. Com `notFound()` ali, quem ativava com
   * sucesso terminava olhando para "Não encontramos essa página" — foi o
   * que a primeira versão fez, e o que este teste pegou. O destino virou
   * `/perfil/assinatura` na #170, junto com o fim da carência.
   */
  test("quem já é prestador é levado à assinatura, não a um 404", async () => {
    const resposta = await page.goto("/perfil/virar-prestador");

    expect(resposta?.status()).toBe(200);
    await expect(page).toHaveURL(/\/perfil\/assinatura$/);
  });
  /*
   * A área de contratação do prestador (#189).
   *
   * Estes quatro testes são o que sustenta a exclusão de `/contratar/**`
   * da varredura de rotas: sem eles, a linha em `ROTAS_NAO_VARRIDAS`
   * diria "não é varrida" e alguém leria "está coberta em outro lugar" —
   * o mal-entendido exato que deixou o fluxo de cobrança inteiro sem
   * teste de ponta a ponta até a #164.
   */
  test("o prestador tem a própria área de contratação", async () => {
    const resposta = await page.goto("/contratar");

    expect(resposta?.status()).toBe(200);
    await expect(page).toHaveURL(/\/contratar$/);
  });

  /**
   * O bug que a #189 existe para matar.
   *
   * O painel oferecia "Cadastrar empresa" apontando para
   * `/cadastro?tipo=empresa` — o formulário de conta **nova**. Como o
   * perfil de contratante do prestador só nasce na primeira vaga
   * publicada, ele chegava aqui sem perfil e era mandado criar outra
   * conta: o saldo de vagas ficava preso na primeira, e ele pagaria duas
   * vezes sem entender por quê.
   */
  test("o painel vazio não manda criar uma segunda conta", async () => {
    await page.goto("/contratar");

    await expect(
      page.getByRole("link", { name: /cadastrar empresa/i }),
    ).toHaveCount(0);
    await expect(page.locator('a[href^="/cadastro"]')).toHaveCount(0);

    /*
     * O estado vazio em si não é alcançável aqui, e isso é do modo
     * demonstração: `empresaDoPainel()` mapeia qualquer sessão para a
     * empresa de exemplo, então `company` nunca vem nulo. O que este
     * teste trava é o que importa e vale nos dois modos — **nenhum
     * caminho desta área leva ao cadastro de conta nova**. A variante do
     * convite certo ("publicar primeira vaga") é coberta no teste de
     * unidade do painel, onde o repositório é injetável.
     */
    await expect(
      page.getByRole("heading", { name: /contratar/i }),
    ).toBeVisible();
  });

  /** Cada porta atende o próprio papel — nunca a área escrita para CNPJ. */
  test("/empresa devolve o prestador para a área dele", async () => {
    await page.goto("/empresa");
    await expect(page).toHaveURL(/\/contratar$/);
  });

  /**
   * O perfil do prestador perde os dois atalhos (#191).
   *
   * "Minha Empresa" apontava para a área errada; "Minhas candidaturas"
   * abria numa tela vazia para sempre para quem se cadastrou direto como
   * prestador. O acesso continua — o teste logo acima prova que
   * `/perfil/candidaturas` responde 200 —, o que sai é o atalho.
   */
  test("o perfil não oferece Minha Empresa nem Minhas candidaturas", async () => {
    await page.goto("/perfil");

    await expect(
      page.getByRole("link", { name: /minha empresa/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /minhas candidaturas/i }),
    ).toHaveCount(0);

    // No lugar delas, a área que é dele.
    await expect(
      page.getByRole("link", { name: /^contratar/i }).first(),
    ).toBeVisible();
  });
});
