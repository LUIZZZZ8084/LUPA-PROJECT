import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { repositorioPagamentos } from "@/server/pagamentos";
import { RetornoPagamento } from "./retorno-cliente";

export const metadata: Metadata = {
  title: "Confirmando pagamento",
};

export default async function RetornoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const sessao = await sessaoAtual();

  /*
   * Mesma regra de "não encontrado" em vez de "sem permissão": id
   * ausente, sessão ausente ou pagamento de outra pessoa recebem o
   * mesmo 404, sem confirmar qual dos três aconteceu.
   */
  const pagamento = id ? await repositorioPagamentos().porId(id) : null;
  if (!sessao || !pagamento || pagamento.usuarioId !== sessao.usuarioId) {
    notFound();
  }

  return (
    <PageShell width="narrow">
      <PageTitle title="Pagamento" />
      <RetornoPagamento pagamentoId={pagamento.id} />
    </PageShell>
  );
}
