import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO,
  ARQUIVO_SESSAO_EMPRESA,
  aguardarAnimacoes,
  aguardarHidratacao,
  confirmarPublicacao,
  escolherCidade,
} from "./helpers";

/**
 * Perguntas de triagem, do formulário da empresa até a ficha (#491).
 *
 * O caminho inteiro, com as duas pontas: a empresa escreve as perguntas ao
 * publicar, a pessoa responde antes de enviar, e a lista da empresa separa
 * quem respondeu o que a vaga exigia — sem esconder ninguém.
 *
 * Duas vagas, uma com pergunta eliminatória e outra sem, e a mesma pessoa se
 * candidata às duas: é o que permite medir a **ordem** da lista (quem atende
 * vem antes do grupo à parte) com uma conta só.
 */
const PERGUNTA_ELIMINATORIA = "Tem CNH categoria E?";
const PERGUNTA_INFORMATIVA = "Pode viajar a trabalho?";

async function publicar(
  page: Page,
  cargo: string,
  perguntas: { texto: string; eliminatoria: boolean }[] = [],
) {
  await page.goto("/empresa/vagas/nova");
  await aguardarHidratacao(page, "form");
  await page.getByLabel("Cargo").fill(cargo);
  await page.getByLabel("Categoria").selectOption("Logística e Transporte");
  await page.getByLabel("Tipo de contrato").selectOption("CLT");
  await page.getByLabel("Presencial").check();
  await page.getByLabel("Não é para PCD").check();
  await escolherCidade(page, "Sorriso - MT", "Cidade da vaga");
  await page.getByLabel("Endereço").fill("Rua de teste, 100");
  await page
    .getByLabel("Descrição da vaga")
    .fill(
      "Vaga de teste automatizado para conferir as perguntas de triagem " +
        "do formulário até a lista da empresa.",
    );

  for (const [i, p] of perguntas.entries()) {
    await page.getByLabel(`Pergunta ${i + 1}`, { exact: true }).fill(p.texto);
    if (p.eliminatoria) {
      await page.getByLabel(`Pergunta ${i + 1} é eliminatória`).check();
    }
  }

  await confirmarPublicacao(page);
  await expect(
    page.getByRole("heading", { name: "Vaga publicada" }),
  ).toBeVisible({ timeout: 20_000 });
}

async function candidatarSeA(browser: Browser, cargo: string) {
  const contexto = await browser.newContext({ storageState: ARQUIVO_SESSAO });
  const page = await contexto.newPage();
  await page.goto(`/vagas?q=${encodeURIComponent(cargo)}`);
  await page
    .getByRole("link", { name: new RegExp(cargo) })
    .first()
    .click();
  await page.waitForURL(/\/vagas\/[^/?]+$/);
  return { contexto, page };
}

test.describe("perguntas de triagem", () => {
  test("da publicação à ficha: quem atende vem antes, e ninguém some", async ({
    browser,
  }) => {
    const sufixo = Date.now();
    const comPergunta = `Motorista com Triagem ${sufixo}`;
    const semPergunta = `Motorista sem Triagem ${sufixo}`;

    const empresa = await browser.newContext({
      storageState: ARQUIVO_SESSAO_EMPRESA,
    });
    const painel = await empresa.newPage();

    // 1. A empresa escreve as perguntas, e a revisão as mostra.
    await painel.goto("/empresa/vagas/nova");
    await aguardarHidratacao(painel, "form");
    await painel.getByLabel("Cargo").fill(comPergunta);
    await painel.getByLabel("Categoria").selectOption("Logística e Transporte");
    await painel.getByLabel("Tipo de contrato").selectOption("CLT");
    await painel.getByLabel("Presencial").check();
    await painel.getByLabel("Não é para PCD").check();
    await escolherCidade(painel, "Sorriso - MT", "Cidade da vaga");
    await painel.getByLabel("Endereço").fill("Rua de teste, 100");
    await painel
      .getByLabel("Descrição da vaga")
      .fill(
        "Vaga de teste automatizado para conferir as perguntas de triagem " +
          "do formulário até a lista da empresa.",
      );
    await painel
      .getByLabel("Pergunta 1", { exact: true })
      .fill(PERGUNTA_ELIMINATORIA);
    await painel.getByLabel("Pergunta 1 é eliminatória").check();
    await painel
      .getByLabel("Pergunta 2", { exact: true })
      .fill(PERGUNTA_INFORMATIVA);

    await painel
      .getByRole("button", { name: /revisar antes de publicar/i })
      .click();
    const revisao = painel.getByRole("region", { name: "Revisão da vaga" });
    await expect(revisao.getByText(PERGUNTA_ELIMINATORIA)).toBeVisible();
    await expect(
      revisao.getByText("Eliminatória", { exact: true }),
    ).toBeVisible();
    await expect(
      revisao.getByText("Informativa", { exact: true }),
    ).toBeVisible();
    await expect(
      revisao.getByText(/envia a candidatura do mesmo jeito/i),
    ).toBeVisible();

    await painel.getByRole("button", { name: /confirmar e publicar/i }).click();
    await expect(
      painel.getByRole("heading", { name: "Vaga publicada" }),
    ).toBeVisible({ timeout: 20_000 });

    // 2. A segunda vaga, sem pergunta nenhuma.
    await publicar(painel, semPergunta);

    // 3. A pessoa se candidata à vaga com perguntas.
    const a = await candidatarSeA(browser, comPergunta);
    await a.page.getByRole("button", { name: "Candidatar-se" }).click();

    // Nenhuma resposta vem marcada, e o envio espera todas.
    const enviar = a.page.getByRole("button", { name: "Enviar candidatura" });
    await expect(enviar).toBeDisabled();
    await expect(a.page.getByText(/Faltam 2 perguntas/)).toBeVisible();
    await expect(a.page.getByText(/indispensável para a vaga/i)).toHaveCount(1);

    // A tela de resposta passa no contraste, nos dois estados do botão.
    await aguardarAnimacoes(a.page);
    const { violations } = await new AxeBuilder({ page: a.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);

    // Responde Não à eliminatória: ela envia do mesmo jeito.
    const grupo = (texto: string) =>
      a.page.getByRole("group", { name: new RegExp(texto) });
    // Toca no rótulo, como a pessoa toca: o alvo de 44 px é o rótulo inteiro.
    const tocar = async (pergunta: string, resposta: "Sim" | "Não") => {
      await grupo(pergunta)
        .locator("label")
        .filter({ hasText: resposta })
        .click();
      await expect(grupo(pergunta).getByLabel(resposta)).toBeChecked();
    };
    await tocar(PERGUNTA_ELIMINATORIA, "Não");
    await expect(enviar).toBeDisabled();
    await tocar(PERGUNTA_INFORMATIVA, "Sim");
    await expect(enviar).toBeEnabled();
    await enviar.click();
    await expect(a.page.getByText("Candidatura enviada")).toBeVisible({
      timeout: 15_000,
    });

    // 4. E à vaga sem pergunta, num toque, como sempre.
    await a.page.goto(`/vagas?q=${encodeURIComponent(semPergunta)}`);
    await a.page
      .getByRole("link", { name: new RegExp(semPergunta) })
      .first()
      .click();
    await a.page.waitForURL(/\/vagas\/[^/?]+$/);
    await a.page.getByRole("button", { name: "Candidatar-se" }).click();
    await expect(a.page.getByText("Candidatura enviada")).toBeVisible({
      timeout: 15_000,
    });
    await a.contexto.close();

    // 5. O funil da empresa (#511): na coluna, quem atende primeiro, o outro
    // grupo à parte.
    await painel.goto("/empresa/funil");
    // As duas candidaturas acabaram de chegar: estão na coluna das novas.
    const novas = painel.getByRole("region", { name: /^Nova:/ });
    const atende = novas.getByRole("link", { name: /Pessoa de Teste/ }).filter({
      hasText: semPergunta,
    });
    const naoAtende = novas
      .getByRole("link", { name: /Pessoa de Teste/ })
      .filter({ hasText: comPergunta });
    const separador = novas.getByText(
      /Não responderam o que a vaga exigia \(\d+\)/,
    );

    await expect(atende).toBeVisible();
    await expect(naoAtende).toBeVisible();
    await expect(separador).toBeVisible();
    // O motivo está escrito na linha, sem abrir a ficha.
    await expect(
      novas.getByText(`Respondeu Não: ${PERGUNTA_ELIMINATORIA}`).first(),
    ).toBeVisible();

    const yAtende = (await atende.boundingBox())?.y ?? 0;
    const ySeparador = (await separador.boundingBox())?.y ?? 0;
    const yNaoAtende = (await naoAtende.boundingBox())?.y ?? 0;
    expect(yAtende, "quem atende vem antes do grupo à parte").toBeLessThan(
      ySeparador,
    );
    expect(ySeparador).toBeLessThan(yNaoAtende);

    // 6. A ficha mostra a resposta ao lado da pergunta.
    await naoAtende.click();
    await painel.waitForURL(/\/candidaturas\//);
    await expect(
      painel.getByRole("heading", { name: "Respostas às perguntas" }),
    ).toBeVisible();
    await expect(
      painel.getByText("Não respondeu o que a vaga exigia"),
    ).toBeVisible();
    await expect(painel.getByText(PERGUNTA_ELIMINATORIA)).toBeVisible();
    await expect(
      painel.getByText("eliminatória", { exact: true }),
    ).toBeVisible();

    await aguardarAnimacoes(painel);
    const ficha = await new AxeBuilder({ page: painel })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(ficha.violations.map((v) => v.id)).toEqual([]);

    await empresa.close();
  });

  test("pergunta com link é recusada no formulário", async ({ browser }) => {
    const empresa = await browser.newContext({
      storageState: ARQUIVO_SESSAO_EMPRESA,
    });
    const page = await empresa.newPage();

    await page.goto("/empresa/vagas/nova");
    await aguardarHidratacao(page, "form");
    await page.getByLabel("Cargo").fill(`Vaga com Link ${Date.now()}`);
    await page.getByLabel("Categoria").selectOption("Logística e Transporte");
    await page.getByLabel("Tipo de contrato").selectOption("CLT");
    await page.getByLabel("Presencial").check();
    await page.getByLabel("Não é para PCD").check();
    await escolherCidade(page, "Sorriso - MT", "Cidade da vaga");
    await page.getByLabel("Endereço").fill("Rua de teste, 100");
    await page
      .getByLabel("Descrição da vaga")
      .fill(
        "Vaga de teste automatizado para conferir que pergunta com link " +
          "não é aceita no formulário.",
      );
    await page
      .getByLabel("Pergunta 1", { exact: true })
      .fill("Já conhece www.renda-extra.example?");

    await confirmarPublicacao(page);

    // A recusa chega na revisão; o motivo está no campo, ao voltar.
    await page.getByRole("button", { name: /voltar e corrigir/i }).click();
    await expect(page.getByText(/A pergunta não pode ter link/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Vaga publicada" }),
    ).toHaveCount(0);

    await empresa.close();
  });
});
