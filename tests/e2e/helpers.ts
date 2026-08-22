import { join } from "node:path";
import type { Page } from "@playwright/test";

/** Onde a sessão compartilhada dos testes fica guardada. */
export const ARQUIVO_SESSAO = join(
  process.cwd(),
  "test-results",
  "sessao.json",
);

/**
 * Espera o React assumir o controle da página.
 *
 * Sem isso, o teste altera o HTML servido antes de existir listener e o
 * clique some no vazio — que é exatamente o que acontece com uma pessoa
 * num aparelho lento. O app continua funcionando nesse intervalo porque a
 * barra de filtros é um form GET de verdade; o teste, porém, precisa
 * exercitar o caminho com JavaScript.
 */
export async function aguardarHidratacao(page: Page, seletor = "select") {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return Object.keys(el).some((k) => k.startsWith("__react"));
    },
    seletor,
    { timeout: 15_000 },
  );
}

/**
 * Cria uma conta e entra.
 *
 * O app é fechado: sem sessão, toda rota redireciona para `/entrar`. As
 * varreduras de layout e acessibilidade mediriam a tela de login enquanto
 * dizem que medem a busca de vagas — o mesmo erro que já aconteceu aqui
 * quando `/admin` entrou na varredura e o que era medido era o 404.
 *
 * Cadastra em vez de logar porque em demonstração o repositório é de
 * memória: não há conta pré-existente, e o e-mail único evita colisão
 * entre testes que rodam em paralelo contra o mesmo servidor.
 */
export async function entrarComoTeste(page: Page): Promise<void> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.lupa`;

  await page.goto("/cadastro?tipo=candidato_clt");

  await page.getByLabel("Nome completo").fill("Pessoa de Teste");
  await page.getByLabel("E-mail").fill(email);
  // `celularValido` exige 11 dígitos com o terceiro em 9. Os números
  // neutralizados do seed não passam aqui de propósito: aquilo é dado de
  // vitrine inserido por SQL, isto é cadastro passando pela validação real.
  await page.getByLabel("WhatsApp").fill("66999999999");
  await page.getByLabel("Área desejada").selectOption({ index: 1 });
  await page.getByLabel("Senha").fill("senha-de-teste-123");

  await page.getByRole("button", { name: /criar conta/i }).click();
  await page.getByText(/Conta criada/i).waitFor({ timeout: 15_000 });
}

/**
 * Espera as animações de entrada terminarem.
 *
 * O app anima a entrada dos elementos com opacidade, e opacidade sobre
 * texto derruba o contraste abaixo do mínimo legível — armadilha já
 * conhecida aqui. Medir acessibilidade no meio da transição acusa
 * violação em elemento que, parado, passa folgado.
 *
 * `networkidle` mascarava isso por acidente, esperando tempo suficiente
 * para a animação acabar. Esperar pela coisa certa é mais rápido e não
 * depende de a rede ficar quieta — o que, com o app fechado por login,
 * às vezes não acontece.
 */
export async function aguardarAnimacoes(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== "running"),
    undefined,
    { timeout: 10_000 },
  );
}
