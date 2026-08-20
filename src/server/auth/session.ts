import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { log } from "../logger";
import { ehPapel, type Papel } from "./rbac";

/**
 * Sessão em JWT dentro de cookie httpOnly.
 *
 * JWT em vez de sessão em banco porque o app roda em funções serverless:
 * não há processo de longa duração para guardar estado, e cada consulta a
 * mais é latência para quem está num 3G em Sinop.
 *
 * O preço é não conseguir revogar um token antes de expirar. Por isso a
 * validade é curta (7 dias) e o payload carrega só id e papel — nunca nome,
 * e-mail ou telefone, que ficariam legíveis para quem abrisse o cookie.
 */

export const NOME_COOKIE = "lupa_sessao";

/** Sete dias: renovar toda semana incomoda pouco e limita o estrago. */
const VALIDADE_SEGUNDOS = 7 * 24 * 60 * 60;

/** Abaixo disso, o token é reemitido em silêncio na próxima navegação. */
const RENOVAR_QUANDO_FALTAR = 2 * 24 * 60 * 60;

export interface Sessao {
  usuarioId: string;
  papel: Papel;
  /** Epoch em segundos. */
  expiraEm: number;
}

/**
 * Segredo de assinatura.
 *
 * Em produção, faltar `SESSION_SECRET` derruba a aplicação na inicialização,
 * de propósito: subir com um segredo padrão significa que qualquer um que
 * leia o repositório consegue forjar uma sessão de admin. Falhar cedo e
 * barulhento é melhor do que a alternativa.
 */
let segredoCache: Uint8Array | null = null;

function segredo(): Uint8Array {
  if (segredoCache) return segredoCache;

  const bruto = process.env.SESSION_SECRET;

  if (!bruto || bruto.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET ausente ou com menos de 32 caracteres. " +
          "Gere um com: openssl rand -base64 48",
      );
    }
    log.warn(
      "SESSION_SECRET não configurado; usando segredo de desenvolvimento",
      {
        acao: "auth.segredo",
      },
    );
    segredoCache = new TextEncoder().encode(
      "segredo-apenas-de-desenvolvimento-nao-use-em-producao",
    );
    return segredoCache;
  }

  segredoCache = new TextEncoder().encode(bruto);
  return segredoCache;
}

/** Só para teste: força a releitura da variável de ambiente. */
export function limparCacheDoSegredo(): void {
  segredoCache = null;
}

export async function assinarSessao(
  usuarioId: string,
  papel: Papel,
): Promise<{ token: string; expiraEm: number }> {
  const agora = Math.floor(Date.now() / 1000);
  const expiraEm = agora + VALIDADE_SEGUNDOS;

  const token = await new SignJWT({ papel })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(usuarioId)
    .setIssuedAt(agora)
    .setExpirationTime(expiraEm)
    .setIssuer("lupa")
    .setAudience("lupa-app")
    .sign(segredo());

  return { token, expiraEm };
}

/**
 * Lê e valida o token. Devolve null em qualquer problema — expirado,
 * assinatura inválida, payload adulterado — sem lançar, porque "sem sessão"
 * é um estado normal, não uma falha.
 */
export async function lerSessao(token: string): Promise<Sessao | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, segredo(), {
      issuer: "lupa",
      audience: "lupa-app",
      algorithms: ["HS256"],
    });

    if (!payload.sub || !ehPapel(payload.papel) || !payload.exp) return null;

    return {
      usuarioId: payload.sub,
      papel: payload.papel,
      expiraEm: payload.exp,
    };
  } catch {
    // Token inválido é rotina: expirou, veio de outro ambiente, foi mexido.
    return null;
  }
}

function opcoesDoCookie(maxAge: number) {
  return {
    httpOnly: true,
    // Fora de HTTPS o navegador descarta o cookie Secure, e o login para de
    // funcionar em desenvolvimento.
    secure: process.env.NODE_ENV === "production",
    // Lax deixa o cookie viajar num clique vindo de fora — necessário para
    // link de e-mail — mas bloqueia envio em requisição de outro site.
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Reemite o token quando está perto de vencer.
 *
 * Quem usa toda semana nunca é deslogado; quem some por sete dias precisa
 * entrar de novo. Devolve o token novo, ou null se ainda não é hora.
 */
export async function renovarSeNecessario(
  sessao: Sessao,
): Promise<string | null> {
  const faltando = sessao.expiraEm - Math.floor(Date.now() / 1000);
  if (faltando > RENOVAR_QUANDO_FALTAR) return null;

  const { token } = await assinarSessao(sessao.usuarioId, sessao.papel);
  return token;
}

export const CONFIG_SESSAO = {
  NOME_COOKIE,
  VALIDADE_SEGUNDOS,
  RENOVAR_QUANDO_FALTAR,
  opcoesDoCookie,
};
