import { expect, test } from "@playwright/test";
import { ARQUIVO_SESSAO_EMPRESA, aguardarHidratacao } from "./helpers";

/**
 * Vaga publicada fora de Sinop precisa aparecer na busca — Issue #76.
 *
 * O defeito era invisível pelo lado da empresa: a vaga aparecia no painel
 * e nos destaques da home, e sumia de `/vagas`. A home consulta `getJobs()`
 * sem filtro; a busca preenchia a cidade com "Sinop" quando a URL não
 * trazia nenhuma, que é como a página abre. Quem publicava em Sorriso
 * concluía que a publicação não tinha funcionado.
 *
 * O teste percorre o caminho inteiro no navegador, e não a camada de dados:
 * `getJobs()` sempre esteve certo, e um teste sobre ele passaria verde com
 * o bug em pé — foi exatamente assim que ele sobreviveu ao PR que abriu os
 * 142 municípios.
 *
 * A sessão é a de empresa criada no setup: a compartilhada da suíte é de
 * candidato, e candidato não tem `vaga:publicar`.
 */
test.describe("vaga publicada fora de Sinop", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  const CIDADE = "Sorriso";

  test("aparece na busca de vagas, e não só na home", async ({ page }) => {
    const cargo = `Conferente de Pátio E2E ${Date.now()}`;

    await page.goto("/empresa/vagas/nova");
    await page.getByLabel("Cargo").fill(cargo);
    await page.getByLabel("Categoria").selectOption("Logística e Transporte");
    await page.getByLabel("Tipo de contrato").selectOption("CLT");
    await page.getByLabel("Cidade da vaga").selectOption(CIDADE);
    await page
      .getByLabel("Descrição da vaga")
      .fill(
        "Vaga de teste automatizado para conferir se a busca mostra vaga " +
          "publicada fora da cidade inicial.",
      );

    await page.getByRole("button", { name: /Publicar vaga/i }).click();
    await expect(page.getByText("Vaga publicada")).toBeVisible();

    // A confirmação fala da cidade da vaga, não da cidade inicial do app.
    await expect(
      page.getByText(new RegExp(`emprego em ${CIDADE}`)),
    ).toBeVisible();

    /*
     * `/vagas` sem parâmetro nenhum — é assim que se chega pelo menu, e era
     * aqui que a vaga sumia.
     */
    await page.goto("/vagas");
    await expect(
      page.getByRole("link", { name: new RegExp(cargo) }),
    ).toBeVisible();

    /*
     * A home não é conferida aqui de propósito, embora seja o contraste que
     * denunciou o problema. Ela mostra só os quatro destaques mais
     * recentes, e a suíte roda em dois projetos com dois trabalhadores
     * publicando contra o mesmo servidor — a vaga deste teste sai da lista
     * porque outro teste publicou depois, não porque o app regrediu. Teste
     * que falha às vezes ensina a ignorar vermelho.
     */
  });

  /**
   * A outra metade do acerto: soltar o padrão não pode ter soltado o
   * filtro. Escolher uma cidade continua restringindo a ela.
   */
  test("filtrar por Sinop continua escondendo a vaga de outra cidade", async ({
    page,
  }) => {
    const cargo = `Auxiliar de Expedição E2E ${Date.now()}`;

    await page.goto("/empresa/vagas/nova");
    await page.getByLabel("Cargo").fill(cargo);
    await page.getByLabel("Categoria").selectOption("Logística e Transporte");
    await page.getByLabel("Tipo de contrato").selectOption("CLT");
    await page.getByLabel("Cidade da vaga").selectOption(CIDADE);
    await page
      .getByLabel("Descrição da vaga")
      .fill(
        "Vaga de teste automatizado para conferir que o filtro de cidade " +
          "continua separando um município do outro.",
      );

    await page.getByRole("button", { name: /Publicar vaga/i }).click();
    await expect(page.getByText("Vaga publicada")).toBeVisible();

    const link = page.getByRole("link", { name: new RegExp(cargo) });

    await page.goto("/vagas?cidade=Sinop");
    await expect(link).toHaveCount(0);

    await page.goto(`/vagas?cidade=${CIDADE}`);
    await expect(link).toBeVisible();

    // E o chip volta a "Todo o MT" ao limpar, mostrando a vaga de novo.
    await page.goto("/vagas");
    await aguardarHidratacao(page);
    await expect(page.getByLabel("Todo o MT")).toHaveValue("");
    await expect(link).toBeVisible();
  });
});
