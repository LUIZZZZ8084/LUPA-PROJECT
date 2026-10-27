import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * A revisão antes de publicar, e a vaga que não se edita depois (#173).
 *
 * As duas metades são a mesma decisão. Vaga publicada deixou de ser
 * editável porque, com cobrança por vaga (#172), editar era o caminho
 * óbvio para não pagar — publica uma e reescreve por dentro a cada vaga
 * nova. Tirar a edição sem dar uma conferência antes seria cobrar da
 * empresa o erro de digitação dela: corrigir uma vírgula custaria outro
 * crédito.
 *
 * O que se protege aqui é o par inteiro: que a revisão mostre **o que foi
 * digitado**, que ela avise antes do botão, e que voltar não perca o que
 * a pessoa preencheu.
 */
test.describe("revisão antes de publicar", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  const CARGO = `Conferente de Revisão E2E ${Date.now()}`;
  const DESCRICAO =
    "Conferência de carga e apoio à expedição.\n\nRequisitos: ensino médio completo.";

  /** `pcd` é o que a empresa responde; `null` deixa a pergunta em branco. */
  async function preencher(
    page: import("@playwright/test").Page,
    pcd: "sim" | "nao" | null = "nao",
  ) {
    await page.goto("/empresa/vagas/nova");
    await page.getByLabel("Cargo").fill(CARGO);
    await page.getByLabel("Categoria").selectOption("Logística e Transporte");
    await page.getByLabel("Tipo de contrato").selectOption("CLT");
    await page.getByLabel("Presencial").check();
    if (pcd === "sim") await page.getByLabel("Sim, é para PCD").check();
    if (pcd === "nao") await page.getByLabel("Não é para PCD").check();
    await page.getByLabel("Endereço").fill("Rua da Revisão, 500");
    await page.getByLabel("Salário de (R$)").fill("2200");
    await page.getByLabel("Descrição da vaga").fill(DESCRICAO);
  }

  /**
   * O botão não publica — leva à conferência. É a diferença entre a
   * empresa descobrir o erro agora e descobrir com a vaga no ar, sem
   * poder corrigir.
   */
  test("o botão leva à revisão, e não publica direto", async ({ page }) => {
    await preencher(page);

    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();

    await expect(
      page.getByRole("heading", {
        name: /não pode ser editada/i,
      }),
      "o aviso vem antes do botão de confirmar, não depois",
    ).toBeVisible();
    await expect(page.getByText(/como o candidato vai ver/i)).toBeVisible();

    // Ainda não publicou: a confirmação é um segundo clique.
    await expect(
      page.getByRole("heading", { name: "Vaga publicada" }),
    ).toHaveCount(0);
  });

  /**
   * A revisão mostra o que foi digitado — não um resumo aproximado.
   *
   * Uma tela de conferência que renderiza outra coisa é pior que não ter
   * conferência nenhuma: dá confiança sem dar garantia.
   */
  test("mostra o que foi preenchido, com o salário formatado", async ({
    page,
  }) => {
    await preencher(page);
    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();

    /*
     * Escopado à revisão: o formulário continua montado por baixo, só
     * escondido, então cada valor existe duas vezes na página — uma no
     * preview e outra no campo que o gerou. É de propósito, e é o que
     * faz "voltar e corrigir" não perder o que foi digitado.
     */
    const revisao = page.getByRole("region", { name: "Revisão da vaga" });

    await expect(revisao.getByRole("heading", { name: CARGO })).toBeVisible();
    await expect(revisao.getByText("Logística e Transporte")).toBeVisible();
    await expect(
      revisao.getByText("Presencial", { exact: true }),
      "a modalidade escolhida aparece como selo (#300)",
    ).toBeVisible();
    await expect(revisao.getByText("Rua da Revisão, 500")).toBeVisible();
    await expect(revisao.getByText(/A partir de.*2\.200/)).toBeVisible();
    await expect(revisao.getByText(/Conferência de carga/)).toBeVisible();
  });

  /** Voltar não pode custar o que a pessoa já escreveu. */
  test("voltar preserva o que foi digitado", async ({ page }) => {
    await preencher(page);
    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();

    await page.getByRole("button", { name: /voltar e corrigir/i }).click();

    await expect(page.getByLabel("Cargo")).toHaveValue(CARGO);
    await expect(page.getByLabel("Descrição da vaga")).toHaveValue(DESCRICAO);
    await expect(page.getByLabel("Presencial")).toBeChecked();
  });

  /*
   * A pergunta do PCD é obrigatória e sem resposta de antemão (#456): a
   * empresa não chega à revisão sem ter dito sim ou não. Um padrão marcado
   * faria a resposta sair sem ninguém ter respondido.
   */
  test("sem responder se é para PCD, não chega à revisão", async ({ page }) => {
    await preencher(page, null);

    await expect(page.getByLabel("Sim, é para PCD")).not.toBeChecked();
    await expect(page.getByLabel("Não é para PCD")).not.toBeChecked();

    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();

    await expect(
      page.getByRole("region", { name: "Revisão da vaga" }),
    ).toHaveCount(0);
  });

  test("vaga para PCD ganha o selo na revisão", async ({ page }) => {
    await preencher(page, "sim");
    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();

    const revisao = page.getByRole("region", { name: "Revisão da vaga" });
    await expect(revisao.getByText("Vaga para PCD")).toBeVisible();
  });

  test("vaga que não é para PCD não leva o selo", async ({ page }) => {
    await preencher(page);
    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();

    const revisao = page.getByRole("region", { name: "Revisão da vaga" });
    await expect(revisao.getByRole("heading", { name: CARGO })).toBeVisible();
    await expect(revisao.getByText("Vaga para PCD")).toHaveCount(0);
  });

  test("confirmar publica de verdade", async ({ page }) => {
    await preencher(page);
    await page
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();
    await page.getByRole("button", { name: /confirmar e publicar/i }).click();

    await expect(
      page.getByRole("heading", { name: "Vaga publicada" }),
    ).toBeVisible({ timeout: 20_000 });
  });

  /**
   * A outra metade da regra: não existe mais tela de edição.
   *
   * Um link que sobrevivesse à remoção devolveria 404 na cara de quem
   * clicasse — a armadilha do "link que aparece e devolve erro" que este
   * projeto já registra três vezes.
   */
  test("o painel não oferece mais editar vaga", async ({ page }) => {
    await page.goto("/empresa");

    await expect(
      page.locator('a[href$="/editar"][href^="/empresa/vagas/"]'),
    ).toHaveCount(0);
  });
  /**
   * O direito de publicar aparece antes dos campos (#193).
   *
   * O aviso antigo vivia no rodapé e dizia só *que* publicar usa uma vaga.
   * Aqui a conta da suíte tem o plano ilimitado, então o que se confere é
   * o lugar — que a tela informa o que a pessoa pode publicar antes do
   * primeiro campo. Os estados de "sem saldo", plano cheio e primeira vaga
   * grátis ficam no teste de componente (`saldo-ao-publicar.test.tsx`), e o
   * plano com teto em `planos-de-vaga.spec.ts`.
   */
  test("o formulário diz o que dá para publicar, antes dos campos", async ({
    page,
  }) => {
    await page.goto("/empresa/vagas/nova");

    const aviso = page.getByText(/plano ilimitado ativo/i).first();
    await expect(aviso).toBeVisible();

    // Antes do primeiro campo, não depois do último.
    const posicaoAviso = await aviso.boundingBox();
    const posicaoCargo = await page.getByLabel("Cargo").boundingBox();
    expect(posicaoAviso?.y ?? 0).toBeLessThan(posicaoCargo?.y ?? 0);
  });
});
