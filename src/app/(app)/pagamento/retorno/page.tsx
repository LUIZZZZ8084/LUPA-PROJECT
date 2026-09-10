import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { repositorioPagamentos } from "@/server/pagamentos";
import { RetornoAssinatura } from "./retorno-cliente";

export const metadata: Metadata = {
  title: "Confirmando assinatura",
};

export default async function RetornoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ assinatura?: string }>;
}) {
  const { assinatura: id } = await searchParams;
  const sessao = await sessaoAtual();

  /*
   * Mesma regra de "não encontrado" em vez de "sem permissão": id
   * ausente, sessão ausente ou assinatura de outra pessoa recebem o
   * mesmo 404, sem confirmar qual dos três aconteceu.
   */
  const assinatura = id
    ? await repositorioPagamentos().assinaturaPorId(id)
    : null;
  if (!sessao || !assinatura || assinatura.usuarioId !== sessao.usuarioId) {
    notFound();
  }

  return (
    <PageShell width="narrow">
      <PageTitle title="Assinatura" />
      <RetornoAssinatura assinaturaId={assinatura.id} />
    </PageShell>
  );
}
