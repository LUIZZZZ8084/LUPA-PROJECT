import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { confirmarEmail } from "@/server/auth/verificacao-email";

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
 * confirmou para uma tela de login — e o token, que é de uso único, já
 * teria sido gasto ou nem chegaria a ser lido.
 *
 * **A confirmação acontece na renderização, não num botão.** Quem abriu o
 * link já disse o que queria dizer; pedir mais um clique seria atrito por
 * cerimônia. O risco de pré-carregamento de link não existe aqui: quem
 * carrega o e-mail é o cliente de e-mail da própria pessoa, e o efeito —
 * confirmar o próprio endereço — é o que ela pediu.
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
  const confirmado = token ? await confirmarEmail(token) : false;

  return (
    <PageShell width="narrow">
      <PageTitle
        title={confirmado ? "E-mail confirmado" : "Link inválido"}
        accent={confirmado ? "text-vagas" : "text-warn"}
        description={
          confirmado
            ? "Pronto. Agora dá para recuperar a sua conta se você esquecer a senha."
            : "Este link não vale mais."
        }
      />

      <Panel className="flex items-start gap-3">
        {confirmado ? (
          <CheckCircle2 size={20} className="mt-0.5 flex-none text-vagas" />
        ) : (
          <XCircle size={20} className="mt-0.5 flex-none text-warn" />
        )}

        <div className="min-w-0 text-sm leading-relaxed text-muted">
          {confirmado ? (
            <p>
              Era só isso. Você não precisa fazer mais nada — e nada tinha
              deixado de funcionar enquanto o e-mail não estava confirmado.
            </p>
          ) : (
            <p>
              O link vale por 24 horas e só pode ser usado uma vez. Entre na sua
              conta e peça um novo em{" "}
              <strong className="text-ink">Perfil</strong>.
            </p>
          )}
        </div>
      </Panel>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ButtonLink href="/perfil" variant="vagas">
          Ir para o perfil
        </ButtonLink>
        <Link href="/vagas" className="text-muted text-xs underline">
          Ver vagas
        </Link>
      </div>
    </PageShell>
  );
}
