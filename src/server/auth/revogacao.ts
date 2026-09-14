import "server-only";

import { unstable_cache, updateTag } from "next/cache";
import { repositorioUsuarios } from "../repositories";
import type { Sessao } from "./session";

/**
 * Revogação de sessão sem sessão no banco (#225).
 *
 * A sessão é um JWT de 7 dias e não mora no banco: o app roda em funções
 * serverless, e cada consulta a mais é latência para quem está em 3G em
 * Sinop. Essa decisão continua valendo.
 *
 * O preço registrado era não conseguir revogar antes de expirar — e o caso
 * que dói é o mais importante de todos: **quem troca a senha porque
 * desconfia de acesso indevido** continuava com o invasor dentro por até
 * uma semana. A tela de troca dizia isso com todas as letras, o que é
 * honesto e não ajuda em nada quem está sendo invadido agora.
 *
 * ## Por que isto não é "sessão no banco"
 *
 * Sessão no banco significa perguntar, a cada requisição, se aquela sessão
 * ainda vale — uma consulta por navegação, para todo mundo, o tempo todo.
 *
 * Aqui a pergunta é outra, e a diferença é o custo: em vez de perguntar
 * sobre **esta** sessão, o app lê a lista de **quem cortou as próprias
 * sessões nos últimos 7 dias** e a guarda em cache por 60 segundos. No
 * caminho comum não há consulta nenhuma.
 *
 * A lista é curta por construção e **não cresce com o tempo**: token com
 * mais de 7 dias já expirou sozinho, então quem trocou a senha no mês
 * passado sai dela. Ela cresce com o número de trocas de senha desta
 * semana — num app de 26 contas, é quase sempre vazia.
 *
 * ## O preço novo, aceito
 *
 * Uma sessão revogada pode sobreviver até 60 segundos. Contra sete dias,
 * é exatamente o que se queria comprar. E quem acabou de trocar a senha
 * recebe sessão nova na mesma ação, então não se atrapalha com o próprio
 * corte.
 *
 * `updateTag` na hora da troca encurta ainda mais essa janela para quem
 * está na mesma requisição — é a mesma dupla que `cache-de-listagem.ts`
 * usa, e pelo mesmo motivo: quem acabou de escrever não pode ser quem
 * espera o cache vencer.
 */

/**
 * Sete dias: o alcance da lista é a validade máxima de um token.
 *
 * Não é número solto — é o mesmo `VALIDADE_SEGUNDOS` da sessão, dito em
 * dias. Corte mais velho que isso não pode invalidar nada, porque não
 * existe token vivo daquela época. É o que mantém a lista curta para
 * sempre, e não só hoje.
 */
const DIAS_DE_ALCANCE = 7;

/** Um minuto: o quanto uma sessão revogada ainda pode andar. */
const JANELA_DE_CACHE = 60;

export const TAG_REVOGACOES = "auth:revogacoes";

/**
 * A lista, em cache.
 *
 * A chave é fixa porque a lista é uma só — ela não depende de quem
 * pergunta, e é justamente isso que a torna cacheável. Guardar por pessoa
 * seria uma entrada por conta, cada uma exigindo a própria consulta: o
 * oposto do que este arquivo existe para evitar.
 */
const lerCortes = unstable_cache(
  async () => {
    const cortes = await repositorioUsuarios().cortesDeSessao(DIAS_DE_ALCANCE);
    // `unstable_cache` serializa o retorno, e `Map` não sobrevive a JSON.
    return Object.fromEntries(cortes);
  },
  ["auth", "cortes-de-sessao"],
  { revalidate: JANELA_DE_CACHE, tags: [TAG_REVOGACOES] },
);

/**
 * Esta sessão nasceu antes do corte de quem a carrega?
 *
 * Falha **aberta** de propósito: se a leitura der erro, a sessão continua
 * valendo. É a escolha oposta à do webhook de pagamento, e pelo motivo
 * oposto — lá, deixar passar confirma dinheiro que ninguém provou; aqui,
 * recusar derrubaria todo mundo do app por causa de uma consulta que não
 * respondeu. O risco de errar para o lado permissivo é uma janela a mais
 * numa revogação; o de errar para o fechado é o app inteiro fora do ar.
 */
export async function sessaoFoiRevogada(sessao: Sessao): Promise<boolean> {
  let cortes: Record<string, number>;
  try {
    cortes = await lerCortes();
  } catch {
    return false;
  }

  const corte = cortes[sessao.usuarioId];
  if (!corte) return false;

  /*
   * Estritamente menor, e não "menor ou igual".
   *
   * Trocar a senha grava o corte e emite a sessão nova quase no mesmo
   * instante, e os dois valores são epoch de **segundos**. Com `<=`, a
   * sessão recém-emitida cairia no próprio corte quando as duas coisas
   * caíssem no mesmo segundo — a pessoa trocaria a senha e seria
   * deslogada, de forma intermitente e impossível de reproduzir.
   *
   * O que se perde: um token emitido no mesmo segundo do corte sobrevive.
   * Para isso importar, o invasor teria de ter entrado no exato segundo
   * em que a vítima trocou a senha.
   */
  return sessao.emitidoEm < corte;
}

/**
 * Derruba o cache da lista.
 *
 * Chamada por quem troca a senha, na mesma server action. Sem ela o corte
 * só valeria quando a janela vencesse — e o caso que importa é justamente
 * o de quem está agindo agora.
 */
export function derrubarCacheDeRevogacoes(): void {
  updateTag(TAG_REVOGACOES);
}
