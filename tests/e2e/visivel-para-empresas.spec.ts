import { expect, test } from "@playwright/test";

/**
 * "Quero que empresas me encontrem", no navegador.
 *
 * O que se confere aqui é o que mais importa numa opção de privacidade:
 * que ela nasce desligada, que a pessoa entende o que está ligando, e que
 * dá para desligar. "Não consegui desligar" é o pior defeito possível numa
 * caixa dessas.
 */
/*
 * A tela tem um formulário por assunto, cada um com o próprio botão — é
 * decisão registrada no AGENTS.md, para ninguém ter de reenviar o
 * currículo inteiro só para corrigir o telefone.
 *
 * Consequência para o teste: "o primeiro Salvar da página" é o da seção
 * errada. O botão precisa ser o do formulário que contém a caixa.
 */
const formularioDaCaixa = (page: import("@playwright/test").Page) =>
  page.locator("form", {
    has: page.getByLabel(/quero que empresas me encontrem/i),
  });

/**
 * Salva e espera o "Salvo" aparecer.
 *
 * Esperar um tempo fixo depois do clique parecia funcionar e escondia uma
 * corrida: recarregar antes de a server action terminar cancela o
 * salvamento, e o teste acusa "não persistiu" num código que persiste.
 * Esperar pela coisa certa é mais rápido e não mente.
 */
async function salvarEEsperar(page: import("@playwright/test").Page) {
  const form = formularioDaCaixa(page);
  await form.getByRole("button", { name: /salvar/i }).click();
  await expect(form.getByText("Salvo")).toBeVisible();
}

/*
 * Em série, e não por gosto de lentidão.
 *
 * A suíte compartilha uma conta só (`storageState`), e estes testes ligam
 * e desligam a mesma opção nessa conta. Com dois trabalhadores, o que
 * desmarca roda enquanto o outro marca, e o vermelho aparece no teste
 * errado — foi exatamente o que aconteceu aqui antes.
 */
test.describe.configure({ mode: "serial" });

test.describe("ser encontrado por empresas", () => {
  test("nasce desligada, e explica o que faz", async ({ page }) => {
    await page.goto("/perfil/editar");

    const caixa = page.getByLabel(/quero que empresas me encontrem/i);
    await expect(caixa).toBeVisible();
    await expect(caixa).not.toBeChecked();

    // Sem a explicação, a pessoa marca sem saber o que entregou.
    await expect(
      page.getByText(/seu currículo continua privado/i),
    ).toBeVisible();
    await expect(page.getByText(/pode desmarcar quando quiser/i)).toBeVisible();
  });

  test("liga, salva, e continua ligada depois de recarregar", async ({
    page,
  }) => {
    await page.goto("/perfil/editar");

    const caixa = page.getByLabel(/quero que empresas me encontrem/i);
    await caixa.check();
    await salvarEEsperar(page);

    await page.reload();
    await expect(
      page.getByLabel(/quero que empresas me encontrem/i),
    ).toBeChecked();
  });

  /*
   * O caso que não pode falhar. Caixa não marcada não é enviada pelo
   * formulário — chega ausente, não como "false". Sem tratar isso, o
   * desmarcar não desligaria nada e a pessoa continuaria exposta achando
   * que tinha saído.
   */
  test("desmarcar desliga de verdade", async ({ page }) => {
    await page.goto("/perfil/editar");

    await page.getByLabel(/quero que empresas me encontrem/i).check();
    await salvarEEsperar(page);

    await page.reload();
    await page.getByLabel(/quero que empresas me encontrem/i).uncheck();
    await salvarEEsperar(page);

    await page.reload();
    await expect(
      page.getByLabel(/quero que empresas me encontrem/i),
    ).not.toBeChecked();
  });
});
