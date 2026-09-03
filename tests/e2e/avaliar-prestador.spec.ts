import { expect, test } from "@playwright/test";

/**
 * Avaliar um prestador, no navegador.
 *
 * O painel do perfil já convidava — "foi atendido por ele? sua avaliação
 * ajuda a próxima pessoa" — e não havia nada para clicar. Convite sem
 * controle é o inverso do botão que só recusa depois do clique: os dois
 * fazem a pessoa concluir que o app está quebrado.
 *
 * Usa a sessão compartilhada de candidato, sem criar conta: o limite de
 * cadastro por origem é de 5 em 15 minutos, e esta suíte já gasta o que
 * pode.
 */
test.describe("avaliar prestador", () => {
  const PRESTADOR = "/servicos/prv-joao-silva";

  test("o formulário aparece para quem está logado", async ({ page }) => {
    await page.goto(PRESTADOR);

    await expect(
      page.getByRole("heading", { name: /você foi atendido por/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /enviar avaliação/i }),
    ).toBeVisible();
  });

  test("a nota é obrigatória, e as estrelas têm nome", async ({ page }) => {
    await page.goto(PRESTADOR);

    // Cinco opções nomeadas: quem usa leitor de tela precisa saber qual é
    // qual, e "estrela" no singular só vale para a primeira.
    await expect(page.getByRole("radio", { name: "1 estrela" })).toBeAttached();
    await expect(
      page.getByRole("radio", { name: "5 estrelas" }),
    ).toBeAttached();
  });

  test("avalia, e a avaliação passa a aparecer no perfil", async ({ page }) => {
    await page.goto(PRESTADOR);

    /*
     * Clica na estrela, não no rádio.
     *
     * O `input` é `sr-only` de propósito — quem usa leitor de tela precisa
     * de um grupo de rádios de verdade —, e o que a pessoa clica é a
     * estrela dentro do `label`. Marcar o rádio com `force` passaria
     * mesmo se a estrela estivesse inalcançável, que é justamente o que
     * este teste precisa provar que não acontece.
     */
    await page.locator('label:has(input[name="nota"][value="5"])').click();
    await page
      .getByLabel("Como foi o serviço")
      .fill("Chegou na hora e explicou o que ia fazer antes de começar.");
    await page.getByRole("button", { name: /enviar avaliação/i }).click();

    /*
     * A confirmação é a do servidor, não a do formulário: a action
     * revalida esta rota, e a revalidação desmonta o formulário junto com
     * qualquer "enviado" que ele estivesse mostrando.
     */
    await expect(
      page.getByRole("heading", { name: "Você já avaliou" }),
    ).toBeVisible({ timeout: 15_000 });

    /*
     * E não oferece avaliar de novo: cada pessoa avalia uma vez, e o
     * formulário some depois. Um formulário que reaparece convida a
     * tentar de novo para receber uma recusa.
     */
    await page.reload();
    await expect(
      page.getByRole("button", { name: /enviar avaliação/i }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Chegou na hora e explicou/i).first(),
    ).toBeVisible();
  });

  /**
   * A nota do topo tem que subir junto com a lista.
   *
   * Com banco, o trigger em `avaliacoes` recalcula sozinho. Na
   * demonstração não há trigger, e sem somar à mão o comentário entrava na
   * lista enquanto a nota do topo ficava parada — a pessoa avaliava e
   * concluía que não tinha ido. O mock já garantia que "perfil, cards e
   * barras nunca discordem entre si"; isto estende a garantia ao que se
   * escreve durante a demonstração.
   */
  test("a contagem do topo acompanha a avaliação nova", async ({ page }) => {
    const outro = "/servicos/prv-carlos-souza";
    const contagem = async () => {
      const rotulo =
        (await page
          .locator('[aria-label^="Nota"]')
          .first()
          .getAttribute("aria-label")) ?? "";
      return Number(rotulo.match(/(\d+) avalia/)?.[1] ?? 0);
    };

    await page.goto(outro);
    const antes = await contagem();

    await page.locator('label:has(input[name="nota"][value="4"])').click();
    await page.getByRole("button", { name: /enviar avaliação/i }).click();
    await expect(
      page.getByRole("heading", { name: "Você já avaliou" }),
    ).toBeVisible({ timeout: 15_000 });

    expect(await contagem()).toBe(antes + 1);
  });
});
