import { CanalDeContato } from "@/components/canal-de-contato";
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
            cidade: usuario.cidade,
          }
        }
      />
      <div className="flex-1">{children}</div>
      {/*
       * Instagram e e-mail, agora também aqui (#241).
       *
       * O componente nasceu no rodapé de `(auth)` porque aquela era a
       * única parte do app que um visitante sem sessão via — mas a home
       * passou a ser pública, e ela vive neste grupo de rota, não
       * naquele. Mostrar só para quem não tem conta: quem já tem uma
       * encontra o caminho de contato de outras formas, e repetir aqui
       * para todo mundo duplicaria o rodapé de `(auth)` sem necessidade.
       */}
      {!usuario && (
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <CanalDeContato />
        </div>
      )}
      <BottomNav autenticado={Boolean(usuario)} papel={usuario?.papel} />
    </>
  );
}
