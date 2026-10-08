import type { Metadata } from "next";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { ConfirmarEmailForm, LinkInvalido } from "./form";

export const metadata: Metadata = {
  title: "Confirmar e-mail",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A tela que o link do e-mail abre (#227).
 *
 * **Fica em `(auth)` e é aberta**, e as duas coisas são a mesma decisão: a
 * pessoa quase sempre clica no link do celular, que pode não ser o
 * aparelho onde ela está logada. Exigir sessão aqui mandaria quem
 * confirmou para uma tela de login.
 *
 * **A confirmação é um botão, e não a abertura do link (#398).** Este
 * parágrafo dizia o contrário: que pedir mais um clique era cerimônia, e
 * que o risco de pré-carregamento não existia porque quem carrega o e-mail
 * é o cliente da própria pessoa. Não é só ele — filtro de e-mail
 * corporativo e prévia de link abrem os endereços da mensagem para
 * conferir, e o primeiro a abrir gastava o token. Quem clicava depois lia
 * "Este link não vale mais", de um link que nunca tinha usado. Um GET não
 * muda nada; o token é gasto na action, que só o envio do formulário
 * chama.
 *
 * **Token inválido, expirado, já usado ou de outra finalidade dão a mesma
 * tela.** Distinguir só informaria quem está sondando, e para quem clicou
 * os quatro significam a mesma coisa: peça outro.
 */
export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <PageShell width="narrow">
      <PageTitle title="Confirmar e-mail" accent="text-vagas" />
      {token ? <ConfirmarEmailForm token={token} /> : <LinkInvalido />}
    </PageShell>
  );
}
