import { expect, type Page, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * "Encerrar" vaga no painel da empresa (#481).
 *
 * Era um botão vermelho por vaga, repetido na lista (o elemento mais chamativo
 * da tela), e o clique abria o `confirm()` do navegador. Agora o botão é de
 * contorno, o clique abre um quadro de confirmação na própria linha, e só o
 * botão de confirmar é vermelho.
 *
 * O teste **não confirma**: encerrar de verdade mudaria o estado de
 * demonstração, que é compartilhado entre os testes (a contagem de vagas
 * ativas, por exemplo). Cobre-se tudo até o último clique, e o clique em si
 * está nos testes unitários, com a ação simulada.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

const encerrar = (page: Page) =>
  page.getByRole("button", { name: "Encerrar", exact: true }).first();

async function abrirPainel(page: Page) {
  // A lista de vagas é uma aba própria desde a #511.
  await page.goto("/empresa/vagas");
  await page.waitForLoadState("networkidle");
  await expect(encerrar(page)).toBeVisible();
}

test.describe("encerrar vaga", () => {
  test("em repouso o botão é de contorno, sem o vermelho cheio de antes", async ({
    page,
  }) => {
    await abrirPainel(page);

    const fundo = await encerrar(page).evaluate(
      (e) => getComputedStyle(e).backgroundColor,
    );
    // Transparente: o vermelho era `bg-danger/15`, um fundo avermelhado.
    expect(fundo).toBe("rgba(0, 0, 0, 0)");
    await expect(encerrar(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("tocar abre a confirmação na linha, e o navegador não abre caixa nenhuma", async ({
    page,
  }) => {
    const caixas: string[] = [];
    page.on("dialog", async (d) => {
      caixas.push(d.message());
      await d.dismiss();
    });
    await abrirPainel(page);

    await encerrar(page).click();

    const quadro = page.getByRole("group", {
      name: /Confirmar o encerramento de/,
    });
    await expect(quadro).toBeVisible();
    await expect(encerrar(page)).toHaveAttribute("aria-expanded", "true");
    await expect(quadro).toContainText("some da busca pública");
    expect(caixas).toEqual([]);

    // O quadro ocupa a linha da vaga, abaixo do título e do botão.
    const linha = await quadro.locator("xpath=ancestor::li[1]").boundingBox();
    const caixa = await quadro.boundingBox();
    const botao = await encerrar(page).boundingBox();
    expect(linha && caixa && botao).toBeTruthy();
    expect(caixa?.width ?? 0).toBeGreaterThan((linha?.width ?? 0) - 40);
    expect(caixa?.y ?? 0).toBeGreaterThan(
      (botao?.y ?? 0) + (botao?.height ?? 0) - 1,
    );
  });

  test("só o botão de confirmar é vermelho, e 'Voltar' desiste", async ({
    page,
  }) => {
    await abrirPainel(page);
    await encerrar(page).click();

    const confirmar = page.getByRole("button", { name: "Encerrar vaga" });
    const fundo = await confirmar.evaluate(
      (e) => getComputedStyle(e).backgroundColor,
    );
    expect(fundo).not.toBe("rgba(0, 0, 0, 0)");

    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(
      page.getByRole("group", { name: /Confirmar o encerramento de/ }),
    ).toHaveCount(0);
    await expect(encerrar(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("o foco do teclado fica no botão e o quadro é o próximo item da ordem de Tab", async ({
    page,
  }) => {
    await abrirPainel(page);

    await encerrar(page).focus();
    await page.keyboard.press("Enter");
    await expect(encerrar(page)).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Encerrar vaga" }),
    ).toBeFocused();
  });
});
