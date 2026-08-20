import { type NextRequest, NextResponse } from "next/server";
import { pode } from "@/server/auth/rbac";
import { CONFIG_SESSAO, lerSessao } from "@/server/auth/session";

/**
 * Guarda de borda.
 *
 * Roda antes de a página existir, que é onde a proteção de uma área
 * administrativa precisa acontecer. Chamar `notFound()` dentro do componente
 * chega tarde demais: o metadata já foi resolvido — a aba mostrava
 * "Painel · Lupa" mesmo exibindo o corpo do 404 — e a resposta saía com
 * status 200. O 404 precisa ser de verdade, não só na aparência.
 *
 * Convenção `proxy` do Next 16, sucessora do antigo `middleware`.
 *
 * Roda no runtime de borda: só `jose` (JWT) entra aqui. Argon2 é binding
 * nativo e ficaria de fora — mas a borda não precisa dele, porque só lê a
 * assinatura da sessão, nunca uma senha.
 */

/** Prefixos que exigem papel `admin`. */
const PREFIXOS_ADMIN = ["/admin", "/api/admin"];

/**
 * Caminho inexistente de propósito.
 *
 * Reescrever para cá faz o Next renderizar `not-found.tsx` com status 404 e
 * com o metadata da própria página de erro — sem passar pela rota
 * protegida, que nem chega a ser avaliada.
 */
const CAMINHO_INEXISTENTE = "/__nao-encontrado";

function ehRotaDeAdmin(pathname: string): boolean {
  return PREFIXOS_ADMIN.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!ehRotaDeAdmin(pathname)) return NextResponse.next();

  const token = request.cookies.get(CONFIG_SESSAO.NOME_COOKIE)?.value;
  const sessao = token ? await lerSessao(token) : null;

  if (sessao && pode(sessao.papel, "admin:painel")) {
    return NextResponse.next();
  }

  /*
   * Para a API, um JSON de 404 — devolver HTML numa rota de dados confunde
   * o cliente e o log.
   */
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }

  const destino = request.nextUrl.clone();
  destino.pathname = CAMINHO_INEXISTENTE;
  destino.search = "";

  return NextResponse.rewrite(destino, { status: 404 });
}

export const config = {
  matcher: [
    /*
     * Só as rotas administrativas. Rodar em tudo custaria uma verificação de
     * JWT em cada imagem e cada página pública, sem nada a proteger.
     */
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
