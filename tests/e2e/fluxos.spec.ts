import { expect, test } from "@playwright/test";
import { aguardarHidratacao } from "./helpers";

test.describe("busca de vagas", () => {
  test("filtra por categoria e mantém o filtro na URL", async ({ page }) => {
    await page.goto("/vagas");

    await aguardarHidratacao(page);

    const antes = await page.locator('a[href^="/vagas/"]').count();
    expect(antes).toBeGreaterThan(0);

    await page.getByLabel("Categoria").selectOption("Agronegócio");
    await expect(page).toHaveURL(/categoria=Agroneg/);

    const depois = await page.locator('a[href^="/vagas/"]').count();
    expect(depois).toBeGreaterThan(0);
    expect(depois).toBeLessThan(antes);
  });

  test("a busca é compartilhável — a URL reconstrói o resultado", async ({
    page,
  }) => {
    await page.goto("/vagas?categoria=Agroneg%C3%B3cio&tipo=Est%C3%A1gio");
    await expect(page.getByText(/vaga(s)? encontrada/)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Estágio em Agronomia/ }),
    ).toBeVisible();
  });

  test("busca por texto encontra a vaga", async ({ page }) => {
    await page.goto("/vagas");
    await aguardarHidratacao(page);
    await page.getByPlaceholder(/Buscar vaga/).fill("motorista");
    await expect(page).toHaveURL(/q=motorista/);
    await expect(
      page.getByRole("link", { name: /Motorista de Carreta/ }),
    ).toBeVisible();
  });

  test("mostra estado vazio quando nada bate, sem quebrar", async ({
    page,
  }) => {
    await page.goto("/vagas?q=cargoinexistentexyz");
    await expect(
      page.getByText(/Nenhuma vaga com esses filtros/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Limpar busca" }),
    ).toBeVisible();
  });

  test("abre o detalhe e mostra a descrição completa", async ({ page }) => {
    await page.goto("/vagas");
    await page.locator('a[href^="/vagas/"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Sobre a vaga")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Candidatar-se/ }),
    ).toBeVisible();
  });
});

test.describe("busca de prestadores", () => {
  test("filtra por categoria", async ({ page }) => {
    await page.goto("/servicos");
    await aguardarHidratacao(page);
    await page.getByLabel("Categoria").selectOption("eletricista");
    await expect(page).toHaveURL(/categoria=eletricista/);
    await expect(
      page.getByText(/profissionais encontrados|profissional encontrado/),
    ).toBeVisible();
  });

  test("filtra por nota mínima", async ({ page }) => {
    await page.goto("/servicos?avaliacao=4.5");
    const notas = await page
      .locator('[aria-label^="Nota"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.getAttribute("aria-label") ?? "")
          // "Nota 4,7, 7 avaliações" → 4.7 (sem engolir a vírgula seguinte)
          .map((s) =>
            Number(
              (s.match(/Nota (\d+(?:,\d+)?)/)?.[1] ?? "0").replace(",", "."),
            ),
          )
          .filter((n) => n > 0),
      );
    expect(notas.length).toBeGreaterThan(0);
    expect(Math.min(...notas)).toBeGreaterThanOrEqual(4.5);
  });

  test("o perfil mostra avaliações coerentes com a nota", async ({ page }) => {
    await page.goto("/servicos/prv-joao-silva");

    const total = Number(
      (await page.getByText(/^\d+ avaliações$/).textContent())?.match(
        /\d+/,
      )?.[0],
    );
    /*
     * Regressão: o perfil já anunciou 27 avaliações exibindo 3.
     *
     * toHaveCount aguarda, em vez de contar na hora: o painel de avaliações
     * é carregado sob demanda e, sobre a rede real, o chunk chega depois do
     * resto da página. Com count() o teste passava local e falhava em
     * produção — o que mede latência, não corretude.
     */
    await expect(page.locator("main ul li")).toHaveCount(total);
  });
});

test.describe("navegação", () => {
  test("a barra inferior aparece no celular e leva às seções", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: "Serviços" }).click();
    await expect(page).toHaveURL(/\/servicos/);
  });

  test("página inexistente mostra o 404 do Lupa, não um erro cru", async ({
    page,
  }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page.getByText(/Não encontramos essa página/)).toBeVisible();
  });
});

test.describe("segurança da demonstração", () => {
  /**
   * Os prestadores de exemplo têm telefones fictícios mas plausíveis. Num
   * link público, abrir wa.me com eles mandaria mensagem de estranhos para
   * quem realmente tiver o número.
   */
  test("nenhum link wa.me aponta para telefone de prestador fictício", async ({
    page,
  }) => {
    for (const path of ["/", "/servicos", "/servicos/prv-joao-silva"]) {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href*="wa.me"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute("href") ?? ""));

      for (const href of hrefs) {
        expect(
          href,
          `${path} expõe um telefone de demonstração: ${href}`,
        ).not.toMatch(/wa\.me\/55669991100\d/);
      }
    }
  });

  test("o aviso de demonstração aparece em todas as páginas", async ({
    page,
  }) => {
    for (const path of ["/", "/vagas", "/servicos", "/empresa"]) {
      await page.goto(path);
      await expect(
        page.getByText(/não são ofertas reais/),
        `faltando aviso em ${path}`,
      ).toBeVisible();
    }
  });
});

test.describe("registro que não existe", () => {
  /**
   * Mesma lição do 404 administrativo: o que importa é o status, não o
   * texto. Aqui ela custou duas respostas erradas para a mesma URL.
   *
   * `/servicos/prv-joao-silva` usa um id que só existia nos dados de
   * exemplo. Enquanto a camada de dados caía no mock em silêncio, a URL
   * devolvia um perfil de mentira com HTTP 200. Removido o fallback, virou
   * página de erro — ainda 200, porque a exceção acontece depois de o
   * shell ter sido transmitido e o status já não pode mudar.
   *
   * Com o banco ligado o id nem chega a ser comparado: a coluna é `uuid` e
   * o Postgres recusa a forma com 22P02. Nenhum registro poderia
   * corresponder, então a camada de dados devolve null.
   *
   * O status era 200 e virou 404. A causa não era o segmento dinâmico:
   * qualquer `notFound()` do app respondia 200, porque um `loading.tsx` na
   * raiz embrulhava tudo em Suspense e o shell saía antes de a página
   * decidir. Os esqueletos foram para grupos de rota, que os escopam sem
   * mudar a URL.
   */
  /**
   * Status, não aparência. A versão anterior deste teste media o texto da
   * página e passava com 200 servindo o corpo do 404 — monitoramento e
   * buscador leem o status.
   *
   * Usa `page` e não `request`: o app é fechado por login e o contexto de
   * requisição não carrega a sessão, então o que seria medido é o
   * redirecionamento para `/entrar`. Já me enganou uma vez hoje.
   */
  test("id inexistente responde 404 de verdade", async ({ page }) => {
    for (const rota of [
      "/servicos/nao-existe-mesmo",
      "/vagas/nao-existe-mesmo",
    ]) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), `${rota} deveria responder 404`).toBe(404);
    }
  });

  test("não serve perfil de mentira para id que não existe", async ({
    page,
  }) => {
    const resposta = await page.goto("/servicos/nao-existe-mesmo");
    const corpo = (await resposta?.text()) ?? "";

    // Os nomes dos dados de exemplo não podem aparecer: era o que a queda
    // silenciosa fazia, servindo um perfil inteiro para um id inventado.
    for (const nome of ["João Silva", "Carlos Souza", "Ana Paula Ribeiro"]) {
      expect(corpo, `${nome} não deveria aparecer`).not.toContain(nome);
    }
    expect(corpo).not.toContain("wa.me/");
  });
});

test.describe("área administrativa", () => {
  /**
   * O 404 precisa ser de verdade, não só na aparência.
   *
   * A versão anterior deste teste verificava o texto da página. Passava com
   * status 200 servindo o corpo do 404 — media a aparência, não a
   * propriedade. Monitoramento e scanner leem o status, não o texto.
   */
  test("responde 404 de verdade para quem não está autenticado", async ({
    request,
  }) => {
    for (const rota of ["/admin", "/admin/painel", "/api/admin/metricas"]) {
      const resposta = await request.get(rota);
      expect(resposta.status(), `${rota} deveria responder 404`).toBe(404);
    }
  });

  /**
   * O título da aba não pode revelar que existe um painel neste endereço —
   * era o que acontecia quando o metadata da rota protegida era resolvido
   * antes da guarda.
   */
  test("o título não revela a existência do painel", async ({ page }) => {
    await page.goto("/admin/painel");
    await expect(page).not.toHaveTitle(/Painel/);
    await expect(page.getByText(/Não encontramos essa página/)).toBeVisible();
  });

  test("a rota de API devolve JSON, não HTML", async ({ request }) => {
    const resposta = await request.get("/api/admin/metricas");
    expect(resposta.headers()["content-type"]).toContain("application/json");
  });
});
