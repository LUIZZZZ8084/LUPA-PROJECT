import "server-only";

import { revalidatePath, unstable_cache, updateTag } from "next/cache";

/**
 * Cache das leituras de listagem (#206).
 *
 * O app era 100% dinâmico: nenhum `revalidate`, nenhum `unstable_cache`, e
 * oito `force-dynamic`. Toda abertura de tela consultava o Postgres. Com 26
 * contas isso não aparece — o que ele decide é o formato da conta quando
 * aparecer, porque o que a Vercel cobra é **invocação de função**, e leitura
 * repetida é dinheiro gasto para obter a mesma resposta.
 *
 * ## O que se cacheia, e o que nunca
 *
 * **Só a consulta, nunca a página.** A página é pessoal: `/vagas` e
 * `/servicos` reordenam por proximidade de quem está olhando, e o app
 * inteiro fica atrás de login. Servir a página montada de uma pessoa para
 * outra trocaria a ordem e, no limite, o conteúdo.
 *
 * A consulta não é pessoal. Ela depende dos filtros — cidade, categoria,
 * tipo, termo — e de mais nada. A costura já existia no código:
 *
 * ```
 * consulta ao banco  →  recorte  →  ordenarVagas(itens, perto)
 *    igual para todos                    personalizado
 * ```
 *
 * Então a chave do cache carrega os filtros e **não pode** carregar nada de
 * sessão. Há teste que trava isso, porque é a única linha entre "economizar
 * consulta" e "mostrar a lista de alguém para outra pessoa".
 *
 * ## A janela é curta de propósito
 *
 * A home promete "novas vagas entram todo dia" e vaga boa em Sinop some em
 * dois dias. Cache que atrasa a vaga nova quebra a promessa da tela — a
 * mesma família de dano da #76, onde a empresa publicava e não se achava na
 * busca. Sessenta segundos economiza a rajada de quem está navegando entre
 * filtros sem que ninguém perceba atraso.
 *
 * E não é só a janela que protege: publicar, encerrar e reativar vaga
 * invalidam a tag na hora, então o caso que importa — quem acabou de
 * publicar — não espera nada.
 */

/** Sessenta segundos: pega a rajada de navegação, não atrasa publicação. */
export const JANELA_DE_CACHE = 60;

/**
 * As tags que as escritas derrubam.
 *
 * Uma por vertical, e não uma por filtro: a tag existe para ser invalidada
 * por quem escreve, e quem publica uma vaga não sabe — nem deve saber — em
 * quais combinações de filtro ela ia cair.
 */
export const TAG_VAGAS = "listagem:vagas";
export const TAG_PRESTADORES = "listagem:prestadores";

/**
 * Envolve uma leitura de listagem em cache, com a chave que lhe for dada.
 *
 * `chave` precisa descrever **o que** se está pedindo, nunca **quem** está
 * pedindo. Quem chama monta isso a partir dos filtros; o `perto` fica de
 * fora por construção, porque ele não entra na consulta — entra na
 * ordenação, depois.
 */
export function emCache<T>(
  ler: () => Promise<T>,
  chave: string[],
  tag: string,
): Promise<T> {
  return unstable_cache(ler, chave, {
    revalidate: JANELA_DE_CACHE,
    tags: [tag],
  })();
}

/**
 * Derruba o cache das listagens de vaga.
 *
 * Chamada pelas actions que mudam o que a busca mostra. É irmã do
 * `revalidatePath` que elas já fazem, e as duas precisam existir: o path
 * cuida da página renderizada, a tag cuida da consulta guardada por baixo.
 * Esquecer esta faria a empresa publicar, ver a própria vaga no painel
 * (revalidado por path) e **não se achar em `/vagas`** por até um minuto —
 * exatamente o sintoma da #76.
 *
 * **`updateTag`, e não `revalidateTag`.** Os dois derrubam a tag; o
 * primeiro garante *read-your-own-writes* dentro da própria server action,
 * que é precisamente o caso que importa aqui — quem acabou de publicar não
 * pode ser quem espera o cache vencer. `revalidateTag` só marca para
 * expirar, e a resposta que a pessoa recebe logo depois do clique ainda
 * poderia vir da versão velha.
 */
export function derrubarCacheDeVagas(): void {
  updateTag(TAG_VAGAS);
}

/** A mesma coisa para a vitrine de prestadores. */
export function derrubarCacheDePrestadores(): void {
  updateTag(TAG_PRESTADORES);
}

/**
 * Revalida a busca de vagas — a página **e** a consulta por baixo dela.
 *
 * Existe como função única porque são duas chamadas que precisam andar
 * juntas, e este projeto já perdeu essa aposta duas vezes: o
 * `revalidatePath` escrito à mão como `/empresa` ficou para trás na #189 e
 * de novo na #193, em arquivos irmãos. Uma pessoa lembrando de duas
 * chamadas em nove lugares é uma pessoa que vai esquecer numa delas — e o
 * sintoma seria o pior possível: a empresa publica, vê a vaga no painel
 * (revalidado por path) e não se acha em `/vagas` (servido do cache),
 * concluindo que não publicou. É a #76 de novo.
 *
 * Há teste que varre o código e reprova `revalidatePath("/vagas")` solto.
 */
export function revalidarBuscaDeVagas(): void {
  revalidatePath("/vagas");
  derrubarCacheDeVagas();
}

/** A mesma dupla, para a vitrine de prestadores. */
export function revalidarBuscaDePrestadores(): void {
  revalidatePath("/servicos");
  derrubarCacheDePrestadores();
}
