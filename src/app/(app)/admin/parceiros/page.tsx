import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { listarParceiros } from "@/server/parceiros/servico";
import { Parceiros } from "./parceiros-cliente";

export const metadata: Metadata = {
  title: "Parceiros",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Quem usa a Lupa de graça por acordo (#505).
 *
 * Mesma porta das outras telas do admin: sem a capacidade, a página não
 * existe — um 403 confirmaria a área administrativa a quem sonda.
 */
export default async function ParceirosPage() {
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "admin:parceiros")) notFound();

  const linhas = await listarParceiros(sessao);

  return (
    <PageShell width="narrow">
      <BackLink href="/admin/painel" label="Voltar ao painel" />
      <PageTitle
        title="Parceiros"
        accent="text-warn"
        description="Quem usa a Lupa de graça por acordo. Autorize pelo e-mail da conta do parceiro, com prazo ou sem."
      />
      <Parceiros linhas={linhas} />
    </PageShell>
  );
}
