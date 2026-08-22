import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { sessaoAtual } from "@/server/auth/cookies";
import { usuarioDaSessao } from "@/server/auth/servico";

/**
 * O app propriamente dito: cabeçalho, conteúdo e barra inferior.
 *
 * A sessão é lida aqui e desce por prop. O cabeçalho é componente de
 * cliente — precisa do `usePathname` para marcar a seção ativa — e
 * componente de cliente não lê cookie. Um provider de sessão traria de
 * volta o problema de boundary que já deixou a barra de filtros invisível
 * neste projeto.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  const usuario = sessao ? await usuarioDaSessao(sessao.usuarioId) : null;

  return (
    <>
      <AppHeader
        usuario={
          usuario && {
            nome: usuario.nomeCompleto,
            papel: usuario.papel,
            avatarUrl: usuario.avatarUrl ?? null,
          }
        }
      />
      <div className="flex-1">{children}</div>
      <BottomNav autenticado={Boolean(usuario)} />
    </>
  );
}
