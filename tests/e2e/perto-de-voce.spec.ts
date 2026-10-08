import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  confirmarPublicacao,
  escolherCidade,
} from "./helpers";

/**
 * Ordenação por proximidade e título por cidade — Issues #79 e #78.
 *
 * A escada em si tem teste unitário sobre a função pura. O que só o
 * navegador responde é se ela chega à tela: a ordem depende da sessão, e
 * sessão é justamente o que o teste unitário não tem.
 *
 * A sessão é a de empresa criada no setup: publicar vaga exige
 * `vaga:publicar`, que candidato não tem. Ela nasce em Sinop - MT, a
 * cidade que o ajudante de cadastro escolhe — é dela que "perto" é medido
 * aqui.
 */
test.describe("mais perto de você primeiro", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  async function publicar(
    page: import("@playwright/test").Page,
    cidade: string,
    cargo: string,
  ) {
    await page.goto("/empresa/vagas/nova");
    await page.getByLabel("Cargo").fill(cargo);
    await page.getByLabel("Categoria").selectOption("Logística e Transporte");
    await page.getByLabel("Tipo de contrato").selectOption("CLT");
    await page.getByLabel("Presencial").check();
    await escolherCidade(page, cidade, "Cidade da vaga");
    await page.getByLabel("Endereço").fill("Rua de teste, 100");
    await page
      .getByLabel("Descrição da vaga")
      .fill(
        "Vaga de teste automatizado para conferir a ordenação por " +
          "proximidade na busca de vagas.",
      );
    await confirmarPublicacao(page);
    await expect(page.getByText("Vaga publicada")).toBeVisible();
  }

  /**
   * A mais longe é publicada por último, então é a mais recente: por data
   * ela viria na frente das outras. É esse empurrão que o teste mede — se
   * a proximidade não estivesse ligada, a ordem sairia invertida.
   */
  test("a vaga da região vem antes do resto do estado, e o estado antes do país", async ({
    page,
  }) => {
    const selo = Date.now();
    const perto = `Conferente de Pátio Perto ${selo}`;
    const meio = `Conferente de Pátio Meio ${selo}`;
    const longe = `Conferente de Pátio Longe ${selo}`;
    const outroEstado = `Conferente de Pátio Outro Estado ${selo}`;

    // Da mais longe para a mais perto, para a data trabalhar contra o teste.
    await publicar(page, "Cláudia - MT", perto);
    await publicar(page, "Sorriso - MT", meio);
    await publicar(page, "Cuiabá - MT", longe);
    await publicar(page, "Campinas - SP", outroEstado);

    await page.goto("/vagas");

    const cargos = await page
      .locator('a[href^="/vagas/"]')
      .evaluateAll((els) => els.map((e) => e.textContent ?? ""));

    const posicao = (cargo: string) =>
      cargos.findIndex((t) => t.includes(cargo));

    expect(
      posicao(perto),
      `"${perto}" não está na lista`,
    ).toBeGreaterThanOrEqual(0);
    // Cláudia (região imediata de Sinop) → Sorriso (intermediária) →
    // Cuiabá (mesmo estado) → Campinas (outro estado, #301).
    expect(posicao(perto)).toBeLessThan(posicao(meio));
    expect(posicao(meio)).toBeLessThan(posicao(longe));
    expect(posicao(longe)).toBeLessThan(posicao(outroEstado));

    // O filtro de estado separa: em SP, só a de Campinas.
    await page.goto("/vagas?uf=SP");
    await expect(
      page.getByRole("link", { name: new RegExp(outroEstado) }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(longe) }),
    ).toHaveCount(0);
  });

  test("a tela diz que a ordem é por proximidade, e só quando é", async ({
    page,
  }) => {
    await page.goto("/vagas");
    await expect(page.getByText(/mais perto de você primeiro/i)).toBeVisible();

    /*
     * Com uma cidade escolhida a frase sai: ali a proximidade já não decide
     * quase nada, e mantê-la descreveria uma ordenação que não está
     * acontecendo. Ordem anunciada e ordem aplicada precisam ser a mesma —
     * é a lição da #76 aplicada ao contrário.
     */
    await page.goto(`/vagas?cidade=${encodeURIComponent("Sinop - MT")}`);
    await expect(page.getByText(/mais perto de você primeiro/i)).toHaveCount(0);
  });
});

/**
 * O título da página acompanha o lugar filtrado — Issues #78 e #301.
 *
 * Fixo, ele anunciava um lugar para quem abria a busca de outro, inclusive
 * na prévia de link compartilhado. Medido no navegador porque
 * `generateMetadata` roda no servidor e o que importa é o que chega ao
 * `<title>`.
 */
test.describe("título por lugar", () => {
  test("sem lugar escolhido, o título não promete lugar nenhum", async ({
    page,
  }) => {
    await page.goto("/vagas");
    await expect(page).toHaveTitle(/^Vagas de emprego ·/);

    await page.goto("/servicos");
    await expect(page).toHaveTitle(/^Profissionais e serviços ·/);
  });

  test("com cidade escolhida, o título fala dela", async ({ page }) => {
    const sorriso = encodeURIComponent("Sorriso - MT");
    await page.goto(`/vagas?cidade=${sorriso}`);
    await expect(page).toHaveTitle(/Vagas de emprego em Sorriso - MT/);

    await page.goto(`/servicos?cidade=${sorriso}`);
    await expect(page).toHaveTitle(/Profissionais e serviços em Sorriso - MT/);
  });

  test("só com o estado, o título fala do estado", async ({ page }) => {
    await page.goto("/vagas?uf=SP");
    await expect(page).toHaveTitle(/Vagas de emprego em São Paulo/);
  });

  /**
   * Cidade que não existe não vira título.
   *
   * O texto não executa nada — o React escapa —, mas um título que ecoa a
   * URL transforma um domínio confiável em isca: basta mandar o link com a
   * mensagem escolhida dentro. Aqui ele cai no título genérico.
   */
  test("texto inventado na URL não entra no título", async ({ page }) => {
    await page.goto("/vagas?cidade=Clique+aqui+para+receber+o+seguro");
    await expect(page).toHaveTitle(/^Vagas de emprego ·/);
  });
});
