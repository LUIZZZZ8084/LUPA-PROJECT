import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA, aguardarHidratacao } from "./helpers";

/**
 * A ficha do candidato (#618): histórico, contato registrado e talento salvo.
 *
 * O que só o navegador prova: o contato registrado aparece no histórico e o
 * campo volta vazio; salvar nos talentos muda o botão; e as duas coisas
 * continuam lá depois de recarregar — gravadas, não só desenhadas.
 */
test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

async function abrirUmaFicha(page: import("@playwright/test").Page) {
  await page.goto("/empresa/funil");
  const href = await page
    .locator('main a[href^="/empresa/candidaturas/"]')
    .first()
    .getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href as string);
  await aguardarHidratacao(page, "textarea[name=nota]");
  return href as string;
}

test("registrar um contato põe a nota no histórico, e ela fica", async ({
  page,
}, info) => {
  const href = await abrirUmaFicha(page);
  const nota = `Liguei às 10h, retorna amanhã (${info.project.name} ${Date.now()})`;

  const historico = page
    .getByRole("heading", { name: "Histórico" })
    .locator("..");
  await page.getByLabel("Registrar contato").fill(nota);
  await page.getByRole("button", { name: "Registrar no histórico" }).click();

  await expect(page.getByText(nota)).toBeVisible();
  await expect(page.getByLabel("Registrar contato")).toHaveValue("");

  await page.goto(href);
  await expect(page.getByText(nota)).toBeVisible();
  await expect(historico).toBeVisible();
});

test("contato em branco não entra", async ({ page }) => {
  await abrirUmaFicha(page);
  const antes = await page.locator("main ol li").count();
  await page.getByLabel("Registrar contato").fill("   ");
  await page.getByRole("button", { name: "Registrar no histórico" }).click();
  await expect(page.locator("main ol li")).toHaveCount(antes);
});

test("salvar nos talentos muda o botão, e continua salvo depois de recarregar", async ({
  page,
}) => {
  const href = await abrirUmaFicha(page);
  const botao = page.getByRole("button", { name: /nos talentos/ });
  const estava = await botao.getAttribute("aria-pressed");

  await botao.click();
  const agora = estava === "true" ? "false" : "true";
  await expect(botao).toHaveAttribute("aria-pressed", agora);

  // Espera a gravação antes de recarregar: o botão volta a ficar ativo.
  await expect(botao).toBeEnabled();
  await page.goto(href);
  await expect(
    page.getByRole("button", { name: /nos talentos/ }),
  ).toHaveAttribute("aria-pressed", agora);

  // Desfaz, para não deixar o estado mudado para os outros specs.
  await page.getByRole("button", { name: /nos talentos/ }).click();
  await expect(
    page.getByRole("button", { name: /nos talentos/ }),
  ).toHaveAttribute("aria-pressed", estava ?? "false");
  await expect(
    page.getByRole("button", { name: /nos talentos/ }),
  ).toBeEnabled();
});

test("a ficha com o histórico passa no axe", async ({ page }) => {
  await abrirUmaFicha(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});
