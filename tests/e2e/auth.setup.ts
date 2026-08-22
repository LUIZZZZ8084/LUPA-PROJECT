import { test as setup } from "@playwright/test";
import { ARQUIVO_SESSAO, entrarComoTeste } from "./helpers";

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
  await entrarComoTeste(page);
  await page.context().storageState({ path: ARQUIVO_SESSAO });
});
