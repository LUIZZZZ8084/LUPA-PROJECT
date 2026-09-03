import { expect, test } from "@playwright/test";
import {
  ARQUIVO_SESSAO_EMPRESA,
  emailDaConta,
  SENHA_DE_TESTE,
} from "./helpers";

/**
 * O que cada papel alcança, e o que recebe 404.
 *
 * O RBAC tem teste de unidade, e ele responde "a matriz diz o quê". Aqui a
 * pergunta é outra, e é a que interessa a quem sonda: **o servidor responde
 * o quê**. Foram duas coisas diferentes até a #104 — `/empresa` e
 * `/empresa/vagas/nova` liam a sessão e nunca consultavam a matriz, então
 * qualquer conta autenticada abria as duas.
 *
 * A regra da casa é 404 e não 403: um 403 confirma que o recurso existe,
 * informação de graça para quem troca id na URL ou procura o painel de
 * admin. Por isso o que se afirma aqui é sempre o **status**, nunca o texto
 * da tela — a versão antiga de um teste destes media a aparência e passava
 * verde servindo o corpo do 404 com HTTP 200.
 */

/** O nome do cookie de sessão, repetido de propósito.
 *
 * Importar `NOME_COOKIE` do servidor faria o teste concordar com o código
 * em vez de exercitá-lo: renomear o cookie passaria verde e derrubaria
 * toda sessão em produção. Mesma razão do CNPJ em `helpers.ts`.
 */
const COOKIE_DE_SESSAO = "lupa_sessao";

/**
 * O que exige capacidade que o candidato não tem.
 *
 * `/empresa` saiu desta lista em 03/09/2026: ela deixou de responder 404
 * para candidato e passou a explicar o que falta para contratar — decisão
 * do Luiz, porque a barra inferior mostra o item para todo mundo e tocar
 * nele dava erro. Publicar vaga e buscar candidato continuam fechados.
 */
const SO_DE_EMPRESA = ["/empresa/vagas/nova", "/candidatos"];

/** Rotas administrativas: ninguém além do admin as vê existir. */
const SO_DE_ADMIN = ["/admin", "/admin/painel"];

/*
 * Uma execução só, no projeto desktop.
 *
 * Autorização não depende de viewport: rodar nos dois projetos mede a mesma
 * coisa duas vezes e ainda gasta em dobro o limite de tentativas de login,
 * que é de 5 por e-mail em 15 minutos e é proteção de verdade — a suíte é
 * que se ajusta a ele, não o contrário.
 */
// biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação no primeiro argumento e recusa o arquivo inteiro na coleta quando o parâmetro é nomeado. Aqui não se usa fixture nenhuma — o que interessa é o `info`.
test.beforeEach(({}, info) => {
  info.skip(
    info.project.name !== "desktop",
    "autorização não depende de viewport",
  );
});

test.describe("sessão de candidato", () => {
  test("não publica vaga nem busca candidato", async ({ page }) => {
    for (const rota of SO_DE_EMPRESA) {
      const resposta = await page.goto(rota);
      expect(
        resposta?.status(),
        `${rota} devia responder 404 para candidato`,
      ).toBe(404);
    }
  });

  /**
   * A aba Empresa abre e explica, em vez de dar 404.
   *
   * A barra inferior mostra "Empresa" para toda conta com sessão, e antes
   * o toque devolvia página não encontrada — link que aparece e falha, a
   * armadilha que este projeto já registrou duas vezes. Não há segredo a
   * proteger: que exista um painel de quem contrata é evidente pela
   * própria navegação.
   */
  test("a aba Empresa explica o que falta, sem 404", async ({ page }) => {
    const resposta = await page.goto("/empresa");

    expect(resposta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /sua conta ainda não contrata/i }),
    ).toBeVisible();
  });

  test("não alcança a área administrativa", async ({ page }) => {
    for (const rota of SO_DE_ADMIN) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), `${rota} devia responder 404`).toBe(404);
    }
  });

  /**
   * O 404 precisa ser indistinguível do de uma URL inventada, inclusive no
   * título da aba — foi por ali que a existência do painel de admin vazou
   * uma vez, com o metadata resolvido antes da guarda.
   *
   * Passou a medir `/empresa/vagas/nova`, que continua fechada, porque
   * `/empresa` deixou de ser 404 de propósito.
   */
  test("o 404 não denuncia que a rota existe", async ({ page }) => {
    await page.goto("/empresa/vagas/nova");
    await expect(page).not.toHaveTitle(/Publicar/i);
    await expect(page.getByText(/Não encontramos essa página/)).toBeVisible();
  });

  /** O que é dele continua alcançável — portão não pode virar muro. */
  test("alcança o que é dele", async ({ page }) => {
    for (const rota of ["/perfil", "/perfil/editar", "/perfil/candidaturas"]) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), `${rota} devia abrir`).toBe(200);
    }
  });
});

test.describe("sessão de empresa", () => {
  test.use({ storageState: ARQUIVO_SESSAO_EMPRESA });

  test("alcança o painel, a publicação e a busca de candidatos", async ({
    page,
  }) => {
    for (const rota of SO_DE_EMPRESA) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), `${rota} devia abrir para empresa`).toBe(200);
    }
  });

  test("não alcança a área administrativa", async ({ page }) => {
    for (const rota of SO_DE_ADMIN) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), `${rota} devia responder 404`).toBe(404);
    }
  });

  /**
   * Trocar o id na URL é o ataque mais barato que existe contra este app, e
   * o que ele alcançaria aqui é a candidatura de outra empresa: nome,
   * telefone e currículo de quem está procurando emprego.
   *
   * O id inventado tem forma de UUID de propósito. Com um id malformado o
   * Postgres recusa por tipo (22P02) e o 404 sai por acidente, sem que a
   * checagem de dono chegue a ser exercitada.
   */
  test("id inventado não vira registro de outra empresa", async ({ page }) => {
    const inventado = "00000000-0000-4000-8000-000000000001";

    for (const rota of [
      `/empresa/candidaturas/${inventado}`,
      `/empresa/vagas/${inventado}/editar`,
      `/candidatos/${inventado}`,
    ]) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), `${rota} devia responder 404`).toBe(404);
    }
  });

  /**
   * Quem não ligou "quero ser encontrado" não aparece na busca.
   *
   * O consentimento é o que sustenta `/candidatos` existir — o padrão é
   * desligado porque, numa cidade do tamanho de Sinop, o patrão atual pode
   * estar entre as empresas cadastradas. A conta de candidato da suíte
   * nasce com a opção desligada e nunca a liga; se o nome dela aparecesse
   * aqui, o opt-in seria decoração.
   */
  test("quem não consentiu não aparece na lista", async ({ page }) => {
    await page.goto("/candidatos");
    await expect(page.getByText("Pessoa de Teste")).toHaveCount(0);
  });
});

test.describe("o cookie de sessão", () => {
  /**
   * Os atributos do cookie são a diferença entre uma sessão roubável por
   * script e uma que não é. Somem sem quebrar nada — nenhuma tela muda —, e
   * é por isso que a verificação é contra o cookie que o navegador
   * realmente guardou, e não contra `opcoesDoCookie` no código.
   */
  test("é httpOnly, Lax, seguro e de caminho raiz", async ({ page }) => {
    await page.goto("/perfil");

    const cookie = (await page.context().cookies()).find(
      (c) => c.name === COOKIE_DE_SESSAO,
    );

    expect(cookie, "a sessão não gravou cookie nenhum").toBeTruthy();
    expect(cookie?.httpOnly, "script da página leria a sessão").toBe(true);
    expect(cookie?.sameSite, "outro site enviaria a sessão junto").toBe("Lax");
    expect(cookie?.path).toBe("/");
    /*
     * `secure` vale porque o e2e sobe um build de produção — é o mesmo
     * `NODE_ENV` que decide o atributo. Sobre http o navegador descartaria
     * um cookie Secure, mas 127.0.0.1 é origem confiável para o Chrome.
     */
    expect(cookie?.secure, "a sessão viajaria em claro").toBe(true);
  });

  test("cookie adulterado é tratado como sem sessão, não como erro", async ({
    browser,
    baseURL,
  }) => {
    const contexto = await browser.newContext();
    await contexto.addCookies([
      {
        name: COOKIE_DE_SESSAO,
        // Três segmentos, como um JWT de verdade, para a verificação
        // chegar à assinatura em vez de morrer antes, no formato.
        value: "eyJhbGciOiJIUzI1NiJ9.eyJwYXBlbCI6ImFkbWluIn0.assinatura-falsa",
        url: baseURL as string,
      },
    ]);

    const pagina = await contexto.newPage();
    const resposta = await pagina.goto("/perfil");

    // Redireciona para o login, e não 500: assinatura inválida é caso
    // esperado, não exceção.
    expect(pagina.url()).toContain("/entrar");
    expect(resposta?.status()).toBeLessThan(500);

    // E o papel forjado dentro do payload não vale nada.
    const admin = await pagina.goto("/admin/painel");
    expect(admin?.status()).not.toBe(200);

    await contexto.close();
  });
});

test.describe("a tela de entrada", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  /**
   * Redirecionamento aberto.
   *
   * `/entrar?destino=https://outro-site` transformaria o login num
   * trampolim: o golpista manda o link, a pessoa entra de verdade na Lupa e
   * é despejada num site que imita a Lupa pedindo a senha de novo. O `//`
   * também precisa sair, porque o navegador lê `//evil.com` como endereço
   * externo com protocolo relativo.
   */
  for (const destino of [
    "https://exemplo-externo.invalid/roubar",
    "//exemplo-externo.invalid/roubar",
  ]) {
    test(`destino=${destino} não leva para fora do site`, async ({
      page,
      baseURL,
    }) => {
      await page.goto(`/entrar?destino=${encodeURIComponent(destino)}`);

      await page.getByLabel("E-mail").fill(emailDaConta("candidato"));
      await page.getByLabel("Senha").fill(SENHA_DE_TESTE);
      await page.getByRole("button", { name: "Entrar" }).click();

      await page.waitForURL((url) => !url.pathname.startsWith("/entrar"), {
        timeout: 15_000,
      });

      expect(page.url()).not.toContain("exemplo-externo.invalid");
      expect(new URL(page.url()).origin).toBe(
        new URL(baseURL as string).origin,
      );
    });
  }

  /**
   * Enumeração de contas.
   *
   * Ter conta aqui significa estar procurando emprego, e uma mensagem
   * diferente para "este e-mail não existe" viraria a lista de quem está.
   * O tempo de resposta também é igualado (`gastarTempoDeVerificacao`); o
   * que se afirma aqui é o observável e estável, que é a mensagem.
   */
  test("não diz quem tem conta", async ({ page }) => {
    const mensagens: string[] = [];

    for (const email of [
      `nao-existe-${Date.now()}@teste.lupa`,
      emailDaConta("candidato"),
    ]) {
      await page.goto("/entrar");
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill("senha-errada-de-proposito");
      await page.getByRole("button", { name: "Entrar" }).click();

      const erro = page.locator("form p").first();
      await expect(erro).toBeVisible({ timeout: 15_000 });
      mensagens.push(((await erro.textContent()) ?? "").trim());
    }

    expect(mensagens[0], "mensagem vazia: o teste não mediu nada").toBeTruthy();
    expect(mensagens[1], "a mensagem denuncia quem tem conta").toBe(
      mensagens[0],
    );
  });
});

test.describe("entrada de usuário na busca", () => {
  /**
   * Injeção no filtro do PostgREST.
   *
   * O `or()` recebe uma string numa linguagem onde a vírgula separa
   * condições: interpolar o termo ali é injeção, num dialeto diferente do
   * SQL. Já vazou aqui — `zzzznaoexiste,full_name.ilike.*a*` devolvia a
   * base inteira. A afirmação é sobre o comportamento visível: termo que
   * não existe não traz resultado, seja qual for a pontuação.
   */
  test("termo com vírgula e curinga não devolve a base inteira", async ({
    page,
  }) => {
    for (const termo of [
      "zzzznaoexiste,full_name.ilike.*a*",
      "zzzznaoexiste,title.ilike.*a*",
      "zzzznaoexiste*",
    ]) {
      await page.goto(`/vagas?q=${encodeURIComponent(termo)}`);
      await expect(
        page.getByText(/Nenhuma vaga com esses filtros/),
        `"${termo}" trouxe resultado`,
      ).toBeVisible();
    }
  });

  /**
   * XSS refletido.
   *
   * O React escapa por padrão, então isto não é desconfiança dele: é a
   * trava contra o dia em que alguém precisar de `dangerouslySetInnerHTML`
   * para "só destacar o termo buscado". A CSP é a linha seguinte, e tem
   * teste próprio.
   */
  test("termo com HTML não vira elemento na página", async ({ page }) => {
    const payload = '<img src=x onerror="window.__xss=1">';
    await page.goto(`/vagas?q=${encodeURIComponent(payload)}`);

    expect(await page.locator("img[src='x']").count()).toBe(0);
    expect(await page.evaluate(() => "__xss" in window)).toBe(false);

    // E o termo continua aparecendo para a pessoa, como texto: escapar
    // não pode virar engolir. Quem buscou precisa ver o que buscou para
    // saber o que corrigir.
    await expect(page.getByPlaceholder(/Buscar vaga/)).toHaveValue(payload);
  });
});
