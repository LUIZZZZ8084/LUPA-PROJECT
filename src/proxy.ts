import { type NextRequest, NextResponse } from "next/server";
import { type Capacidade, pode } from "@/server/auth/rbac";
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

/**
 * Áreas fechadas por capacidade, e a capacidade que cada uma exige.
 *
 * A guarda vive aqui, e não só na página, por uma razão que já custou
 * caro duas vezes: `notFound()` dentro do componente chega tarde. O
 * metadata já foi resolvido — a aba dizia "Minha Empresa" exibindo o
 * corpo do 404 — e, onde existe `loading.tsx` no ramo, o shell é
 * transmitido antes de a página decidir e **o status fica em 200**. O
 * painel da empresa tem um `loading.tsx` de propósito, para não abrir em
 * branco no 3G; sem esta lista, fechá-lo custaria o esqueleto.
 *
 * O mais específico vence: `/empresa/vagas/nova` exige publicar, que o
 * admin não tem — ele enxerga, e de propósito não publica no lugar de
 * ninguém.
 *
 * `semSessao` separa dois casos que parecem um só. Para quem tem sessão e
 * não pode, a resposta é sempre 404 — 403 confirmaria que a área existe.
 * Para quem não tem sessão nenhuma a pergunta é outra: a área
 * administrativa não se confirma nem para anônimo, mas `/empresa` e
 * `/candidatos` são tela de produto, e a empresa que abre o link do painel
 * deslogada precisa do login com o destino guardado, não de um 404 que a
 * faz achar que perdeu a conta.
 */
interface AreaFechada {
  prefixo: string;
  capacidade: Capacidade;
  semSessao: "404" | "login";
}

const AREAS_FECHADAS: readonly AreaFechada[] = [
  { prefixo: "/api/admin", capacidade: "admin:painel", semSessao: "404" },
  { prefixo: "/admin", capacidade: "admin:painel", semSessao: "404" },
  {
    prefixo: "/empresa/vagas/nova",
    capacidade: "vaga:publicar",
    semSessao: "login",
  },
  /*
   * `/empresa` sai da lista de áreas fechadas.
   *
   * Ela era barrada por `vaga:ver_candidaturas_proprias`, que só a empresa
   * tinha — e a barra inferior mostrava o item para todo mundo. Tocar nele
   * como candidato dava 404: link que aparece e devolve erro, a armadilha
   * que este arquivo já evita em outros lugares.
   *
   * Quem decide agora é a própria página: empresa e prestador veem o
   * painel, candidato vê a explicação do que falta. Não há o que esconder
   * — que exista um painel de contratante não é segredo, ao contrário da
   * área de admin, que continua aqui.
   */
  {
    prefixo: "/candidatos",
    capacidade: "candidato:buscar_disponiveis",
    semSessao: "login",
  },
];

/**
 * O que continua aberto sem sessão.
 *
 * O app é fechado: sem conta não se navega. A razão é de produto — só quem
 * tem perfil se candidata, vê dados de empresa ou entra em contato, e é o
 * cadastro que vira lead.
 *
 * Isto reverte, de propósito, a navegação pública que o AGENTS.md
 * registrava como requisito. O custo aceito é sair da busca do Google:
 * deixa de existir quem chega sozinho.
 *
 * A lista é curta por segurança: o padrão é fechado, e abrir é explícito.
 */
const ABERTAS = ["/entrar", "/cadastro"];

/** Para onde mandar quem não tem sessão. */
const ENTRADA = "/entrar";

function ehRotaAberta(pathname: string): boolean {
  return ABERTAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
}

/**
 * Caminho inexistente de propósito.
 *
 * Reescrever para cá faz o Next renderizar `not-found.tsx` com status 404 e
 * com o metadata da própria página de erro — sem passar pela rota
 * protegida, que nem chega a ser avaliada.
 */
const CAMINHO_INEXISTENTE = "/__nao-encontrado";

/**
 * A área fechada que cobre este caminho, ou `null` se ele é livre para
 * quem tem sessão. Ordem da lista decide: o primeiro que casa vence, e
 * ela está escrita do mais específico para o mais geral.
 */
function areaDe(pathname: string): AreaFechada | null {
  return (
    AREAS_FECHADAS.find(
      ({ prefixo }) =>
        pathname === prefixo || pathname.startsWith(`${prefixo}/`),
    ) ?? null
  );
}

/** O login, com o destino pretendido guardado na query. */
function paraOLogin(request: NextRequest) {
  const login = request.nextUrl.clone();
  const { pathname } = request.nextUrl;
  login.pathname = ENTRADA;
  login.search = "";
  /*
   * O destino pretendido vai junto, para a pessoa terminar onde queria
   * chegar. Sem isso, quem abre o link de uma vaga entra e cai na home,
   * tendo que procurar de novo o que já tinha achado.
   */
  if (pathname !== "/") {
    login.searchParams.set("destino", pathname + request.nextUrl.search);
  }
  return NextResponse.redirect(login);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(CONFIG_SESSAO.NOME_COOKIE)?.value;
  const sessao = token ? await lerSessao(token) : null;

  const area = areaDe(pathname);

  if (!area) {
    if (sessao || ehRotaAberta(pathname)) return NextResponse.next();

    /*
     * Rota de dados sem sessão responde 401, não redirecionamento: um
     * cliente que esperava JSON não sabe o que fazer com uma página HTML
     * de login, e o erro apareceria como parse quebrado.
     */
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    }

    return paraOLogin(request);
  }

  if (sessao && pode(sessao.papel, area.capacidade)) {
    return NextResponse.next();
  }

  if (!sessao && area.semSessao === "login") return paraOLogin(request);

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
     * Tudo, menos o que não é página: estáticos, imagens geradas, o
     * favicon e o manifesto. Verificar JWT em cada arquivo custaria
     * latência sem nada a proteger — e o `_next/static` é servido pela
     * CDN, sem passar por aqui de qualquer forma.
     *
     * Antes o matcher cobria só `/admin`. O app passou a ser fechado, então
     * a borda precisa ver toda navegação; a lista de rotas abertas fica no
     * código, onde dá para explicar cada uma.
     *
     * `manifest.webmanifest` entrou depois, e a ausência dele era um
     * defeito de verdade: o manifesto responde a `/manifest.webmanifest`,
     * gerado por `src/app/manifest.ts` do mesmo jeito que `icon` e
     * `apple-icon` — que já estavam aqui. Barrado, ele redirecionava para
     * o login, e o navegador não lê HTML de login como manifesto: o PWA
     * deixava de ser instalável justamente para quem ainda não tem conta,
     * que é quem acabou de receber o link. Não é navegação e não tem o que
     * proteger; o que ele diz (nome, cor, ícone) já é público.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icon|apple-icon|avatares|.*.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
