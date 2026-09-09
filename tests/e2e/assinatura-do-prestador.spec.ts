import { expect, type Page, test } from "@playwright/test";
import { entrarComoTeste } from "./helpers";

/**
 * A mensalidade do prestador, do clique ao efeito.
 *
 * Este fluxo nasceu sem cobertura de ponta a ponta: `/perfil/assinatura` e
 * `/pagamento/retorno` entraram direto na lista de rotas fora das
 * varreduras, com a razão de que exigem sessão de prestador e as duas
 * contas compartilhadas da suíte são candidata e empresa. A razão era
 * verdadeira e a conclusão não — o custo é uma conta a mais, que este
 * arquivo cria, exatamente como `feed-do-prestador.spec.ts` já fazia.
 *
 * O que se protege aqui é a corrente inteira: assinar cria a cobrança, a
 * cobrança aprovada estende a mensalidade, e a tela passa a dizer que está
 * ativa. Cada elo já tem teste de unidade; o que nenhum deles responde é se
 * eles estão ligados.
 *
 * **Sem Mercado Pago no caminho.** A suíte roda em demonstração por
 * construção, e sem `MERCADO_PAGO_ACCESS_TOKEN` a cobrança é aprovada na
 * hora, sem rede. É o que permite exercitar o efeito sem credencial e sem
 * dinheiro — e é a mesma degradação que o resto do app já usa. O caminho
 * com o Mercado Pago de verdade não cabe aqui: depende de credencial de
 * teste, que não vive no repositório.
 */
test.describe.configure({ mode: "serial" });

/*
 * Só no projeto desktop, pela mesma razão dos outros arquivos que criam
 * conta: o cadastro tem limite de 5 por origem em 15 minutos, e rodar nos
 * dois projetos estoura o limite para quem vier depois. O que se testa é
 * estado, não largura de tela — a varredura responsiva já cobre isso.
 */
// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo na coleta quando o parâmetro é nomeado.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "fluxo não depende de viewport");
});

test.describe("assinatura do prestador", () => {
  let page: Page;

  test.beforeAll(async ({ browser }, info) => {
    if (info.project.name !== "desktop") return;

    const contexto = await browser.newContext({ storageState: undefined });
    page = await contexto.newPage();
    await entrarComoTeste(page);

    await page.goto("/perfil/virar-prestador");
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

  /**
   * Quem acabou de virar prestador ganha 30 dias de carência, e a tela
   * precisa dizer isso — senão a pessoa assina de novo sem precisar.
   */
  test("mostra o preço e o estado da mensalidade", async () => {
    await page.goto("/perfil/assinatura");

    await expect(page.getByText("R$ 19,90")).toBeVisible();
    await expect(page.getByText("/mês")).toBeVisible();
    await expect(page.getByText("Ativa", { exact: true })).toBeVisible();
    await expect(page.getByText(/válida até/i)).toBeVisible();
  });

  /**
   * O preço da tela vem de `PRECO_CENTAVOS`, no servidor — não há um
   * segundo lugar onde alguém possa escrever outro valor. Este teste é o
   * que reprova se aparecer um número escrito à mão no meio do caminho.
   */
  test("o preço não aparece em nenhum outro valor na página", async () => {
    await page.goto("/perfil/assinatura");

    const corpo = (await page.textContent("body")) ?? "";
    const precos = corpo.match(/R\$\s?\d+,\d{2}/g) ?? [];

    expect(precos.length).toBeGreaterThan(0);
    expect(new Set(precos).size, `preços divergentes na tela: ${precos}`).toBe(
      1,
    );
  });

  /**
   * A corrente inteira, num clique.
   *
   * Em demonstração a cobrança é aprovada na hora, então o retorno já
   * mostra o resultado final. O que isto prova é que assinar aciona
   * `estenderMensalidade` de verdade — e não que a tela apenas mudou de
   * texto.
   */
  test("assinar estende a mensalidade e volta dizendo que deu certo", async () => {
    test.setTimeout(90_000);
    await page.goto("/perfil/assinatura");

    const antes = await validadeNaTela(page);

    await page.getByRole("button", { name: /assinar|renovar/i }).click();
    await page.waitForURL(/\/pagamento\/retorno/, { timeout: 20_000 });

    /*
     * A rota que a tela consulta em laço, perguntada uma vez e direto.
     *
     * Sem isto, uma falha aqui aparece só como "a tela ficou em
     * Confirmando" — sintoma que serve para dez causas diferentes. A
     * pergunta específica é: quem criou a cobrança consegue lê-la de
     * volta pela API?
     */
    const idDoPagamento = new URL(page.url()).searchParams.get("id") ?? "";
    expect(idDoPagamento, "o retorno precisa carregar o id na URL").not.toBe(
      "",
    );

    /*
     * `page.evaluate` com `fetch`, e não `page.request`: é o mesmo caminho
     * que a tela percorre, com o cookie de sessão do navegador. Uma sonda
     * fora da página mede outra coisa — e a diferença entre "a API está
     * quebrada" e "minha sonda não levou a sessão" é justamente o que
     * este teste precisa distinguir.
     */
    const daApi = await page.evaluate(async (id) => {
      const r = await fetch(`/api/pagamentos/${id}`, { cache: "no-store" });
      return { status: r.status, corpo: await r.text() };
    }, idDoPagamento);

    expect(
      daApi.status,
      `quem criou a cobrança tem de conseguir ler o status dela — recebido: ${daApi.corpo}`,
    ).toBe(200);
    expect(JSON.parse(daApi.corpo).status).toBe("aprovado");

    /*
     * A tela nasce em "Confirmando o pagamento" e só depois consulta o
     * estado: o primeiro poll sai 2s após montar, e daí a cada 2s. Esperar
     * com o prazo padrão de 5s mediria o estado intermediário, não o
     * resultado — que é o que interessa.
     *
     * A asserção é sobre o texto final exato, e não sobre um regex frouxo:
     * "O pagamento não foi aprovado" contém "aprovado", então qualquer
     * padrão que só procure essa palavra passaria também na recusa.
     */
    await expect(
      page.getByRole("heading", { name: "Pagamento aprovado" }),
    ).toBeVisible({ timeout: 30_000 });

    await page.goto("/perfil/assinatura");
    const depois = await validadeNaTela(page);

    expect(
      depois,
      "a validade devia ter avançado depois de assinar",
    ).toBeGreaterThan(antes);
  });

  /**
   * A vitrine é o efeito que a mensalidade compra, e é onde a pessoa vai
   * conferir se valeu. Sem isto, o teste acima provaria só que uma data
   * mudou no banco.
   */
  test("com a mensalidade em dia, o perfil aparece na busca", async () => {
    await page.goto("/servicos");

    await expect(
      page.locator('a[href^="/servicos/"]').first(),
      "a vitrine não pode ficar vazia com prestador pago",
    ).toBeVisible();
  });

  /**
   * Quem não é prestador não tem o que gerenciar — 404, não 403.
   *
   * Usa a sessão compartilhada da suíte, que é candidata, em vez de criar
   * conta. O cadastro tem limite de 5 por origem em 15 minutos, e este
   * arquivo já gasta uma no `beforeAll`: a segunda estourava o teto e
   * derrubava o cadastro do `virar-prestador.spec`, que roda depois. O
   * teste que quebra não é o que erra — foi assim que descobri.
   */
  test("candidato não alcança a tela de assinatura", async ({
    page: comoCandidata,
  }) => {
    const resposta = await comoCandidata.goto("/perfil/assinatura");
    expect(resposta?.status()).toBe(404);
  });
});

/** A data "válida até" da tela, em milissegundos, para comparar antes e depois. */
async function validadeNaTela(page: Page): Promise<number> {
  const texto = (await page.textContent("body")) ?? "";
  const achado = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!achado) return 0;
  const [, dia, mes, ano] = achado;
  return new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime();
}
