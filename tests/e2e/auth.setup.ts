import { writeFileSync } from "node:fs";
import { test as setup } from "@playwright/test";
import {
  ARQUIVO_SESSAO,
  ARQUIVO_SESSAO_EMPRESA,
  arquivoDeCredencial,
  entrarComoEmpresa,
  entrarComoTeste,
} from "./helpers";

/**
 * O e-mail de cada conta, para quem precisa exercitar o *login* — e não
 * apenas estar logado. Um arquivo por papel: os dois setups rodam em
 * paralelo, e num arquivo só quem terminasse por último apagaria o outro.
 */
function guardarCredencial(papel: "candidato" | "empresa", email: string) {
  writeFileSync(arquivoDeCredencial(papel), JSON.stringify({ email }));
}

/**
 * Cria uma conta uma vez e guarda a sessão em disco.
 *
 * A alternativa — cadastrar em cada teste — custa um Argon2id de 19 MiB por
 * vez. Com dezenas de testes em dois projetos, o servidor passa mais tempo
 * derivando hash do que respondendo, e asserções de navegação começam a
 * estourar por timeout sem que nada esteja errado no app.
 *
 * O parâmetro de custo é proposital e não deve ser afrouxado para o teste
 * correr: quem protege senha é ele.
 */
setup("cria a sessão compartilhada", async ({ page }) => {
  const email = await entrarComoTeste(page);
  await page.context().storageState({ path: ARQUIVO_SESSAO });
  guardarCredencial("candidato", email);
});

/**
 * A mesma coisa para empresa, num arquivo à parte.
 *
 * Os testes que publicam vaga precisam de `vaga:publicar`, que candidato
 * não tem. Criar a conta dentro de cada um deles estourava o limite de
 * cadastro por origem no meio da execução — ver o comentário em
 * `ARQUIVO_SESSAO_EMPRESA`.
 */
setup("cria a sessão de empresa", async ({ page }) => {
  const email = await entrarComoEmpresa(page);
  await page.context().storageState({ path: ARQUIVO_SESSAO_EMPRESA });
  guardarCredencial("empresa", email);
});
