import { join } from "node:path";
import type { Page } from "@playwright/test";

/** Onde a sessão compartilhada dos testes fica guardada. */
export const ARQUIVO_SESSAO = join(
  process.cwd(),
  "test-results",
  "sessao.json",
);

/**
 * A sessão de empresa, guardada à parte.
 *
 * Duas contas para a suíte inteira, criadas uma vez cada: a de candidato
 * cobre a maioria dos testes, e esta cobre os que publicam vaga —
 * `vaga:publicar` não está no papel de candidato.
 *
 * Compartilhar não é só economia de Argon2id. O cadastro tem limite por
 * origem (5 em 15 minutos, do PR #57) e a suíte roda dois projetos contra
 * o mesmo servidor: uma conta por teste estourava o limite no meio da
 * execução, e o que falhava era o cadastro do teste seguinte, não o que
 * ele mede. O limite é proteção de verdade contra criação de conta em
 * massa e não deve ser afrouxado para o teste correr — a suíte é que se
 * ajusta a ele.
 */
export const ARQUIVO_SESSAO_EMPRESA = join(
  process.cwd(),
  "test-results",
  "sessao-empresa.json",
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

/**
 * Um CNPJ diferente a cada chamada, com dígito verificador de verdade.
 *
 * Duas exigências que só se atendem gerando: o cadastro recusa CNPJ
 * repetido, e recusa dígito verificador errado. Um literal fixo passa na
 * primeira conta e reprova na segunda — que foi como este ajudante falhou
 * assim que a suíte rodou nos dois projetos, desktop e mobile.
 *
 * A conta da verificação é a mesma de `cnpjValido`, em
 * `src/server/validation.ts`. Repetir a regra aqui é proposital: um
 * ajudante de teste que importa código do servidor deixa de exercitar o
 * contrato e passa a concordar com ele.
 */
function cnpjDeTeste(): string {
  const base = String(Math.floor(Math.random() * 1e12)).padStart(12, "0");

  const digito = (numero: string) => {
    const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2].slice(-numero.length);
    const soma = [...numero].reduce(
      (total, d, i) => total + Number(d) * pesos[i],
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(base);
  return `${base}${d1}${digito(`${base}${d1}`)}`;
}

/**
 * Um CPF diferente a cada chamada, com dígito verificador de verdade.
 *
 * Mesma necessidade do CNPJ acima, e pelo mesmo motivo prático: os dois
 * projetos — desktop e mobile — rodam contra o mesmo servidor. Um literal
 * fixo funciona no primeiro e é recusado no segundo com "este CPF já está
 * em uso", que é o app se comportando certo: um CPF é de uma pessoa só.
 *
 * A conta da verificação é repetida aqui de propósito, como a do CNPJ. Um
 * ajudante de teste que importa `cpfValido` do servidor deixa de exercitar
 * o contrato e passa a concordar com ele.
 */
export function cpfDeTeste(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");

  const digito = (numero: string) => {
    const peso = numero.length + 1;
    const soma = [...numero].reduce(
      (total, d, i) => total + Number(d) * (peso - i),
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(base);
  return `${base}${d1}${digito(`${base}${d1}`)}`;
}

/**
 * Cria uma conta de empresa e entra, num contexto só deste teste.
 *
 * A sessão compartilhada da suíte é de candidato — é o papel que a maioria
 * dos testes precisa, e criar todas as contas de uma vez custaria um
 * Argon2id de 19 MiB por papel em cada execução. Quem precisa publicar
 * vaga paga o preço sozinho, aqui.
 */
export async function entrarComoEmpresa(page: Page): Promise<void> {
  const email = `e2e-empresa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.lupa`;

  await page.goto("/cadastro?tipo=empresa");

  await page.getByLabel("Nome do responsável").fill("Responsável de Teste");
  await page.getByLabel("Nome da empresa").fill("Transportadora de Teste");
  await page.getByLabel("CNPJ").fill(cnpjDeTeste());
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("WhatsApp").fill("66999999999");
  await page.getByLabel("Senha").fill("senha-de-teste-123");

  await page.getByRole("button", { name: /criar conta/i }).click();
  await page.getByText(/Conta criada/i).waitFor({ timeout: 15_000 });
}
