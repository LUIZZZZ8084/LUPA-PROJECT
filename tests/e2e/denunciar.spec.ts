import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Denunciar uma vaga, no navegador (#435).
 *
 * Usa a sessão compartilhada de candidato e a vaga de exemplo da
 * demonstração. O que se prova aqui é o caminho de quem denuncia: o botão
 * discreto, o formulário, a confirmação e a recusa da repetida. A decisão
 * do admin não tem sessão na suíte, e é coberta em `denuncias.test.ts` e,
 * num Postgres de verdade, em `schema.test.ts`.
 */
/*
 * Só no projeto desktop: os dois projetos compartilham conta e servidor, e
 * a denúncia é uma por pessoa enquanto está em análise. Rodando nos dois,
 * o segundo encontraria a recusa — a regra funcionando, não um defeito.
 */
// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo na coleta quando o parâmetro é nomeado.
test.beforeEach(({}, info) => {
  info.skip(info.project.name !== "desktop", "denúncia é uma por pessoa");
});

const VAGA = "/vagas/job-operador-maquinas";

test("denuncia a vaga, e a segunda vez é recusada", async ({ page }, info) => {
  await page.goto(VAGA);

  await page.getByRole("button", { name: "Denunciar esta vaga" }).click();
  await page.getByLabel("Golpe ou cobrança de taxa").check();
  await page
    .getByLabel("Conte o que aconteceu")
    .fill("Pediram pix para marcar a entrevista.");

  // O formulário aberto também precisa passar no contraste: os rádios e o
  // botão de perigo não aparecem na varredura das rotas, que vê só o link.
  const { violations } = await new AxeBuilder({ page })
    .include("form")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Enviar denúncia" }).click();

  /*
   * Na CI o Playwright repete o que falha, e a denúncia da primeira
   * tentativa continua no servidor. Na repetição, a recusa também prova
   * que ela foi gravada.
   */
  const confirmacao = page.getByText(/recebemos sua denúncia/i);
  const recusa = page.getByText(/já denunciou/i);
  await expect(
    info.retry === 0 ? confirmacao : confirmacao.or(recusa),
  ).toBeVisible();

  // De novo, numa visita nova: a primeira está em análise.
  await page.goto(VAGA);
  await page.getByRole("button", { name: "Denunciar esta vaga" }).click();
  await page.getByLabel("Falsa ou enganosa").check();
  await page.getByRole("button", { name: "Enviar denúncia" }).click();

  await expect(recusa).toBeVisible();
  // O erro não apaga a escolha: o formulário continua preenchido.
  await expect(page.getByLabel("Falsa ou enganosa")).toBeChecked();
});
