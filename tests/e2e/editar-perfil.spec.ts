import { expect, test } from "@playwright/test";

/**
 * Editar o perfil e ver o resultado onde ele importa.
 *
 * Os testes de unidade provam que o schema valida e que o repositório
 * grava nas colunas certas. O que só este caminho prova é que o formulário
 * manda os nomes que o servidor espera — foi exatamente aí que o cadastro
 * ficou quebrado para todo mundo, enviando `role` onde o schema lia
 * `papel`, sem que nada além de uma tentativa real acusasse.
 *
 * A sessão compartilhada é de candidato, então o bloco exercitado é o
 * currículo.
 */
test.describe("edição de perfil", () => {
  test("salva a conta e o cabeçalho passa a mostrar o nome novo", async ({
    page,
  }) => {
    await page.goto("/perfil/editar");

    const nome = `Pessoa ${Date.now().toString().slice(-5)}`;
    await page.getByLabel("Nome completo").fill(nome);

    await page
      .locator("form")
      .filter({ hasText: "Sua conta" })
      .getByRole("button", { name: "Salvar" })
      .click();

    await expect(page.getByText("Salvo")).toBeVisible();

    // O cabeçalho mostra o nome de quem entrou: se o revalidate não
    // acontecer, ele fica com o nome velho até a próxima navegação dura.
    await page.goto("/perfil");
    await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  });

  test("salva o currículo e ele aparece no perfil", async ({ page }) => {
    await page.goto("/perfil/editar");

    await page.getByLabel("Área desejada").selectOption("Agronegócio");
    await page.getByLabel("Formação").fill("Ensino médio completo");
    await page.getByLabel("Habilidades").fill("CNH categoria C, Colheitadeira");
    await page.getByLabel("Disponibilidade").fill("Imediata");

    await page
      .locator("form")
      .filter({ hasText: "Currículo" })
      .getByRole("button", { name: "Salvar" })
      .click();

    await expect(page.getByText("Salvo")).toBeVisible();

    await page.goto("/perfil");
    await expect(page.getByText("Ensino médio completo")).toBeVisible();
    await expect(page.getByText("Colheitadeira")).toBeVisible();
    await expect(page.getByText("Imediata")).toBeVisible();
  });

  /**
   * O erro precisa aparecer no campo, não só um aviso genérico. Foi o que
   * faltou no cadastro quebrado: "Revise os campos destacados" sem destacar
   * campo nenhum, porque o que faltava não estava na tela.
   */
  test("erro de validação aponta o campo", async ({ page }) => {
    await page.goto("/perfil/editar");

    await page.getByLabel("WhatsApp").fill("6635110001");
    await page
      .locator("form")
      .filter({ hasText: "Sua conta" })
      .getByRole("button", { name: "Salvar" })
      .click();

    await expect(page.getByText(/celular válido com DDD/i)).toBeVisible();
  });

  test("o perfil leva à edição e a edição volta ao perfil", async ({
    page,
  }) => {
    await page.goto("/perfil");
    await page.getByRole("link", { name: /editar perfil/i }).click();
    await expect(page).toHaveURL(/\/perfil\/editar/);

    await page.getByRole("link", { name: /voltar ao perfil/i }).click();
    await expect(page).toHaveURL(/\/perfil$/);
  });
});

/**
 * Envio de arquivo em modo demonstração.
 *
 * A suíte roda sem Supabase — de propósito, e há teste que falha barulhento
 * se isso mudar. Sem Supabase não há Storage, e o que se verifica aqui é o
 * comportamento nessa situação: a tela precisa dizer que não dá, em vez de
 * aceitar o envio e perder o arquivo. Aceitar em silêncio faria a pessoa
 * achar que salvou.
 */
test.describe("envio de arquivo sem armazenamento", () => {
  test("a tela explica em vez de oferecer um seletor que não funciona", async ({
    page,
  }) => {
    await page.goto("/perfil/editar");

    await expect(page.getByText("Foto de perfil")).toBeVisible();
    await expect(
      page.getByText(/precisa do banco configurado/i).first(),
    ).toBeVisible();

    // Nenhum seletor de arquivo: o que não funciona não é oferecido.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  /** A prévia continua: saber o que existe independe de poder trocar. */
  test("ainda diz o que está gravado hoje", async ({ page }) => {
    await page.goto("/perfil/editar");
    await expect(page.getByText(/Nenhuma imagem enviada/)).toBeVisible();
  });

  test("candidato vê o campo de currículo; a foto todos veem", async ({
    page,
  }) => {
    await page.goto("/perfil/editar");

    await expect(page.getByText("Currículo em PDF")).toBeVisible();
    await expect(page.getByText(/Nenhum currículo enviado/)).toBeVisible();
    // Logo é de empresa; a sessão compartilhada é de candidato.
    await expect(page.getByText("Logo da empresa")).toHaveCount(0);
  });
});
