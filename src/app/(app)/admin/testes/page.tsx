import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";
import { TestesDeCompra } from "./testes-cliente";

export const metadata: Metadata = {
  title: "Testes de compra",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Comprar sem pagar, para conferir se a liberação funciona (#516).
 *
 * Mesma porta das outras telas do admin: sem a capacidade, a página não
 * existe — um 403 confirmaria a área administrativa a quem sonda.
 */
export default async function TestesDeCompraPage() {
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "admin:testar_compras")) notFound();

  return (
    <PageShell width="narrow">
      <BackLink href="/admin/painel" label="Voltar ao painel" />
      <PageTitle
        title="Testes de compra"
        accent="text-warn"
        description="Compre como se tivesse pago e veja o que a pessoa receberia. O Mercado Pago fica de fora; a liberação é a mesma da compra de verdade."
      />
      <TestesDeCompra precos={PRECO_CENTAVOS} />
    </PageShell>
  );
}
