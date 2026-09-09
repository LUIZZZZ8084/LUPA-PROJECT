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
 * O que se protege aqui é a corrente inteira: assinar cria a assinatura
 * recorrente, a primeira cobrança estende a mensalidade, e a tela passa a
 * dizer que renova sozinha. Cada elo já tem teste de unidade; o que nenhum
 * deles responde é se eles estão ligados.
 *
 * E, desde a #170, protege também as duas saídas — cancelar a renovação,
 * que **mantém** os dias já pagos, e a devolução, que só vale na primeira
 * cobrança e derruba tudo na hora. São coisas diferentes, e a diferença
 * entre elas é a única que a pessoa precisa entender nesta tela.
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
  test("mostra o preço, a carência, e que ela ainda não renova sozinha", async () => {
    await page.goto("/perfil/assinatura");

    await expect(page.getByText("R$ 19,90")).toBeVisible();
    await expect(page.getByText("/mês")).toBeVisible();
    await expect(page.getByText("Ativa", { exact: true })).toBeVisible();
    await expect(page.getByText(/vale até/i)).toBeVisible();
    await expect(page.getByText(/não renova sozinha/i)).toBeVisible();
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

    /*
     * O rótulo muda com o estado — "Assinar", "Ativar renovação
     * automática" ou "Continuar assinatura" —, e por isso ele é listado
     * inteiro em vez de um `/renova/i` frouxo: esse padrão casaria também
     * com "Cancelar renovação", que é o botão oposto.
     */
    await page
      .getByRole("button", {
        name: /^(assinar|ativar renovação automática|continuar assinatura)$/i,
      })
      .click();
    await page.waitForURL(/\/pagamento\/retorno/, { timeout: 20_000 });

    /*
     * A rota que a tela consulta em laço, perguntada uma vez e direto.
     *
     * Sem isto, uma falha aqui aparece só como "a tela ficou em
     * Confirmando" — sintoma que serve para dez causas diferentes. A
     * pergunta específica é: quem criou a cobrança consegue lê-la de
     * volta pela API?
     */
    const idDaAssinatura =
      new URL(page.url()).searchParams.get("assinatura") ?? "";
    expect(idDaAssinatura, "o retorno precisa carregar o id na URL").not.toBe(
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
      const r = await fetch(`/api/assinaturas/${id}`, { cache: "no-store" });
      return { status: r.status, corpo: await r.text() };
    }, idDaAssinatura);

    expect(
      daApi.status,
      `quem criou a assinatura tem de conseguir ler o status dela — recebido: ${daApi.corpo}`,
    ).toBe(200);
    expect(JSON.parse(daApi.corpo).status).toBe("ativa");

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

    // E a tela para de dizer que não renova: agora renova.
    await expect(page.getByText(/renova sozinha todo mês/i)).toBeVisible();
  });

  /**
   * Cancelar interrompe o futuro e **não** desfaz o mês pago (#170).
   *
   * É a diferença que decide se a recorrência é produto ou armadilha: sem
   * este botão, quem autorizou uma cobrança mensal só sai dela indo
   * procurar o Mercado Pago, onde não escolheu ter conta. E se cancelar
   * derrubasse a mensalidade na hora, ninguém clicaria — pagou o mês.
   */
  test("cancelar a renovação mantém os dias já pagos", async () => {
    await page.goto("/perfil/assinatura");
    const antes = await validadeNaTela(page);

    await page.getByRole("button", { name: /cancelar renovação/i }).click();
    // O aviso diz o que NÃO se perde, antes de perguntar de novo.
    await expect(page.getByText(/nada é devolvido/i)).toBeVisible();
    await page.getByRole("button", { name: /confirmar cancelamento/i }).click();

    await expect(page.getByText(/não renova sozinha/i)).toBeVisible({
      timeout: 15_000,
    });

    expect(
      await validadeNaTela(page),
      "cancelar não pode encurtar o mês que a pessoa já pagou",
    ).toBe(antes);
    await expect(page.getByText("Ativa", { exact: true })).toBeVisible();
  });

  /**
   * Pedir a devolução pela Lupa, sem entrar no Mercado Pago (#168).
   *
   * O prestador acabou de assinar, então está na primeira cobrança e
   * dentro dos 30 dias — e o botão só existe nessa janela, decidido no
   * servidor. A confirmação é um segundo clique porque a devolução tira a
   * vitrine na hora.
   */
  test("pede a devolução e a mensalidade cai na hora", async () => {
    await page.goto("/perfil/assinatura");

    await expect(page.getByText("Ativa", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /pedir devolução/i }).click();
    /*
     * O aviso diz, antes do segundo clique, as duas coisas que a pessoa
     * precisa saber: que a mensalidade cai na hora e que esta chance não
     * se repete. "Sai da busca" sozinho não serviria de âncora — a
     * própria descrição da mensalidade vencida usa essa frase.
     */
    await expect(page.getByText(/só nesta primeira cobrança/i)).toBeVisible();

    await page.getByRole("button", { name: /confirmar devolução/i }).click();

    await expect(
      page.getByText("Inativa", { exact: true }),
      "a mensalidade tinha de cair junto com a devolução",
    ).toBeVisible({ timeout: 15_000 });

    // E o botão some: não há mais o que devolver.
    await expect(
      page.getByRole("button", { name: /pedir devolução/i }),
    ).toHaveCount(0);
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
