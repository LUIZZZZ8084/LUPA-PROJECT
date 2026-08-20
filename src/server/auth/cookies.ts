import "server-only";

import { cookies } from "next/headers";
import type { Papel } from "./rbac";
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

/** Sessão da requisição atual, ou null. */
export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const token = jar.get(CONFIG_SESSAO.NOME_COOKIE)?.value;
  if (!token) return null;
  return lerSessao(token);
}
