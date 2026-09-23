import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { SEGREDO_DE_SESSAO_MINIMO } from "../config-obrigatoria";
import { log } from "../logger";
import { ehPapel, type Papel } from "./rbac";

/**
 * Sessão em JWT dentro de cookie httpOnly.
 *
 * JWT em vez de sessão em banco porque o app roda em funções serverless:
 * não há processo de longa duração para guardar estado, e cada consulta a
 * mais é latência para quem está num 3G em Sinop.
 *
 * O payload carrega só id e papel — nunca nome, e-mail ou telefone, que
 * ficariam legíveis para quem abrisse o cookie.
 *
 * **O preço de não revogar deixou de ser total (#225).** Era: token válido
 * por até 7 dias, sem volta, mesmo depois de a pessoa trocar a senha
 * desconfiando de invasão. Hoje `usuarios.sessoes_validas_desde` marca um
 * corte por pessoa, e `sessaoAtual()` descarta token emitido antes dele —
 * lendo uma lista curta e cacheada, não uma consulta por requisição. A
 * sessão continua fora do banco; o que entrou foi uma data.
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
  /**
   * Quando o token foi emitido, em epoch de segundos (#225).
   *
   * O `iat` sempre esteve no token; o que faltava era lê-lo. É ele que
   * responde se esta sessão nasceu antes do corte de revogação da pessoa
   * — e é o que permite derrubar sessão antiga sem guardar sessão nenhuma
   * no banco.
   */
  emitidoEm: number;
}

/**
 * Segredo de assinatura.
 *
 * Em produção não existe segredo padrão, de propósito: subir com um
 * segredo versionado significa que qualquer um que leia o repositório
 * consegue forjar uma sessão de admin.
 *
 * **O que derruba a subida não é esta função, e sim
 * `conferirConfiguracaoDeProducao()` (#271).** Este comentário dizia que
 * faltar a variável "derruba a aplicação na inicialização", e não
 * derrubava: esta função só roda quando alguém lê ou assina uma sessão, e
 * `lerSessao` a chama dentro de um `try` que devolve `null`. Sem a
 * variável, o site subia, todo mundo aparecia deslogado em silêncio e o
 * login falhava com erro interno. A recusa daqui continua, como segunda
 * camada — só que ela, sozinha, nunca foi barulhenta.
 */
let segredoCache: Uint8Array | null = null;

function segredo(): Uint8Array {
  if (segredoCache) return segredoCache;

  const bruto = process.env.SESSION_SECRET;

  if (!bruto || bruto.length < SEGREDO_DE_SESSAO_MINIMO) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `SESSION_SECRET ausente ou com menos de ${SEGREDO_DE_SESSAO_MINIMO} caracteres. ` +
          "Gere um com: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"",
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
    // `iat` é escrito por `assinarSessao`; token sem ele não é nosso, e
    // sem ele não há como saber se nasceu antes do corte de revogação.
    if (!payload.iat) return null;

    return {
      usuarioId: payload.sub,
      papel: payload.papel,
      expiraEm: payload.exp,
      emitidoEm: payload.iat,
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
