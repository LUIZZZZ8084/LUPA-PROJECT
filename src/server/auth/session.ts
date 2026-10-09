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

/**
 * `__Host-` onde o cookie é `Secure` (#408).
 *
 * O prefixo é uma regra do navegador, não nossa: cookie com esse nome só é
 * aceito com `Secure`, `Path=/` e sem `Domain`. Sem ele, um subdomínio de
 * `lupapp.com.br`, ou uma resposta em http antes de o HSTS valer, podia
 * gravar um `lupa_sessao` para o domínio inteiro — e a pessoa navegaria na
 * sessão de outro sem saber (fixação de sessão).
 *
 * Só em produção porque fora de HTTPS o cookie não é `Secure`
 * (`opcoesDoCookie`), e o navegador recusaria o nome. A condição é a mesma
 * do `secure`, para os dois não divergirem.
 *
 * Trocar o nome deslogou todo mundo uma vez, no deploy de 09/10/2026:
 * o cookie antigo continua no navegador até vencer, e ninguém o lê.
 */
export const NOME_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-lupa_sessao" : "lupa_sessao";

/**
 * A audiência do token diz de qual ambiente ele veio (#408).
 *
 * Era `lupa-app` em todo lugar. Com o mesmo `SESSION_SECRET` em preview e
 * produção, um token assinado num deploy de preview valia em produção — e
 * o preview pode rodar em modo demonstração, onde qualquer um cria conta,
 * com o papel que quiser escrito no próprio token. Conferir na Vercel que
 * os segredos são diferentes é o certo, e continua sendo; isto é o que
 * segura o dia em que alguém copiar a variável de um ambiente para o
 * outro.
 *
 * Fora da Vercel (`npm run dev`, a suíte) o ambiente é `local`.
 */
function audiencia(): string {
  return `lupa-app:${process.env.VERCEL_ENV ?? "local"}`;
}

/**
 * Sete dias sem abrir o app, e a pessoa entra de novo.
 *
 * É a validade de **cada** token, e funciona como janela de inatividade:
 * quem usa o app renova o token sozinho (`renovarSeNecessario`, chamada
 * pelo `proxy.ts`), e quem some por uma semana precisa fazer login.
 */
const VALIDADE_SEGUNDOS = 7 * 24 * 60 * 60;

/**
 * Renova quando o token tem mais de um dia (#323).
 *
 * Era "quando faltarem dois dias", e a renovação nem era chamada. Com dois
 * dias, quem abrisse o app a cada quatro seria deslogado mesmo assim: no
 * quarto dia faltavam três, não renovava, e no oitavo o token já tinha
 * vencido. Um dia de idade mantém a janela de inatividade em sete dias de
 * verdade, e reescreve o cookie no máximo uma vez por dia.
 */
const RENOVAR_QUANDO_FALTAR = VALIDADE_SEGUNDOS - 24 * 60 * 60;

/**
 * Trinta dias desde o login, e a pessoa entra de novo mesmo usando todo dia.
 *
 * Sem um teto, quem roubasse o cookie e continuasse navegando renovaria a
 * sessão para sempre — e a revogação pela troca de senha (#225) depende de
 * a lista de cortes alcançar o token mais velho que pode estar vivo.
 * `revogacao.ts` lê esta constante para saber quantos dias de cortes olhar;
 * os dois números andam juntos, não lado a lado.
 */
const DURACAO_MAXIMA_SEGUNDOS = 30 * 24 * 60 * 60;

export interface Sessao {
  usuarioId: string;
  papel: Papel;
  /** Epoch em segundos. */
  expiraEm: number;
  /**
   * Quando a pessoa entrou, em epoch de segundos (#225).
   *
   * Vem do `iat`, e a renovação **preserva** o `iat` do login (#323): o
   * token novo diz "esta sessão começou lá atrás", não "agora". É o que
   * responde se a sessão nasceu antes do corte de revogação da pessoa — e
   * o que permite derrubar sessão antiga sem guardar sessão nenhuma no
   * banco. Renovar com `iat` novo faria um token revogado pela troca de
   * senha nascer de novo depois do corte, e escapar dele.
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

/**
 * Assina um token novo.
 *
 * Sem `emitidoEm`, é um login: a sessão começa agora. Com ele, é uma
 * renovação, e o token novo carrega o começo da sessão antiga — e nunca
 * vai além do teto contado dali (`DURACAO_MAXIMA_SEGUNDOS`).
 */
export async function assinarSessao(
  usuarioId: string,
  papel: Papel,
  emitidoEm?: number,
): Promise<{ token: string; expiraEm: number }> {
  const agora = Math.floor(Date.now() / 1000);
  const inicio = emitidoEm ?? agora;
  const expiraEm = Math.min(
    agora + VALIDADE_SEGUNDOS,
    inicio + DURACAO_MAXIMA_SEGUNDOS,
  );

  const token = await new SignJWT({ papel })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(usuarioId)
    .setIssuedAt(inicio)
    .setExpirationTime(expiraEm)
    .setIssuer("lupa")
    .setAudience(audiencia())
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
      audience: audiencia(),
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
 * Reemite o token de quem está usando o app (#323).
 *
 * Existia desde 20/08 e nada a chamava: todo mundo era deslogado sete dias
 * depois de entrar, usando o app todo dia ou não. Hoje o `proxy.ts` a
 * chama a cada navegação.
 *
 * Devolve o token novo, ou `null` quando não há o que fazer: o token ainda
 * é de hoje, ou a sessão já encostou no teto de trinta dias e renovar não
 * lhe daria nem um segundo a mais.
 *
 * O `iat` e o papel são os da sessão antiga. O papel porque quem o troca
 * (virar prestador) já reemite a sessão na mesma action; o `iat` porque é
 * ele que a revogação compara — ver `Sessao.emitidoEm`.
 */
export async function renovarSeNecessario(
  sessao: Sessao,
): Promise<{ token: string; expiraEm: number } | null> {
  const agora = Math.floor(Date.now() / 1000);
  if (sessao.expiraEm - agora > RENOVAR_QUANDO_FALTAR) return null;

  const teto = sessao.emitidoEm + DURACAO_MAXIMA_SEGUNDOS;
  if (Math.min(agora + VALIDADE_SEGUNDOS, teto) <= sessao.expiraEm) {
    return null;
  }

  return assinarSessao(sessao.usuarioId, sessao.papel, sessao.emitidoEm);
}

export const CONFIG_SESSAO = {
  NOME_COOKIE,
  VALIDADE_SEGUNDOS,
  RENOVAR_QUANDO_FALTAR,
  DURACAO_MAXIMA_SEGUNDOS,
  opcoesDoCookie,
};
