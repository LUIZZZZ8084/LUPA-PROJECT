import "server-only";

import { cookies } from "next/headers";
import type { Papel } from "./rbac";
import { sessaoFoiRevogada } from "./revogacao";
import {
  assinarSessao,
  CONFIG_SESSAO,
  lerSessao,
  type Sessao,
} from "./session";

/**
 * Ponte entre a sessão assinada e o cookie da requisição.
 *
 * Separado de `session.ts` de propósito: aquele módulo é puro e roda em
 * qualquer lugar, inclusive nos testes; este depende de `next/headers` e só
 * existe dentro de uma requisição.
 */

export async function criarSessao(
  usuarioId: string,
  papel: Papel,
): Promise<void> {
  const { token } = await assinarSessao(usuarioId, papel);
  const jar = await cookies();
  jar.set(
    CONFIG_SESSAO.NOME_COOKIE,
    token,
    CONFIG_SESSAO.opcoesDoCookie(CONFIG_SESSAO.VALIDADE_SEGUNDOS),
  );
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  // maxAge 0 apaga; escrever vazio sem isso deixaria um cookie inútil.
  jar.set(CONFIG_SESSAO.NOME_COOKIE, "", CONFIG_SESSAO.opcoesDoCookie(0));
}

/**
 * Sessão da requisição atual, ou null.
 *
 * Duas perguntas, não uma: o token é nosso e está no prazo (`lerSessao`),
 * e ele não nasceu antes do corte de revogação da pessoa
 * (`sessaoFoiRevogada`, #225). A segunda existe porque a primeira não
 * responde ao caso que mais importa — quem trocou a senha desconfiando de
 * acesso indevido e continuava com o invasor dentro por até sete dias.
 *
 * **Aqui, e não no `proxy.ts`.** O proxy roda no runtime de borda, onde
 * não há acesso ao banco nem ao cache de dados do Next. E não faz falta:
 * toda rota que decide alguma coisa sobre uma pessoa lê a sessão por esta
 * função — as duas que não leem (o cron e o webhook do Mercado Pago) se
 * autenticam por segredo e por assinatura, não por sessão.
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(CONFIG_SESSAO.NOME_COOKIE)?.value;
  if (!token) return null;

  const sessao = await lerSessao(token);
  if (!sessao) return null;

  return (await sessaoFoiRevogada(sessao)) ? null : sessao;
}
