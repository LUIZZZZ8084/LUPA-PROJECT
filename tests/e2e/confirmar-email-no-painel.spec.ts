import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA } from "./helpers";

/**
 * O painel pede a confirmação do e-mail (#560).
 *
 * A conta de empresa da suíte nasce sem confirmar, como as de produção: o
 * painel diz que o aviso de candidatura depende disso, com o botão de
 * reenviar à mão.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

test("sem e-mail confirmado, o painel avisa e oferece reenviar", async ({
  page,
}) => {
  await page.goto("/empresa");

  await expect(
    page.getByText(/Confirme seu e-mail para saber de cada candidatura/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reenviar confirmação" }),
  ).toBeVisible();
});
