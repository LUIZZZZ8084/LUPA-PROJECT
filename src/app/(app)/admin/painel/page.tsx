import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { buscasSemResultado, DIAS_DA_JANELA } from "@/server/buscas/servico";
import { painelAdmin } from "@/server/metrics/servico";
import { BuscasSemResultado } from "./buscas-sem-resultado";
import { PainelCliente } from "./painel-cliente";

export const metadata: Metadata = {
  title: "Painel",
  // Área administrativa não entra em índice de busca.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PainelAdminPage() {
  const sessao = await sessaoAtual();

  /*
   * Sem permissão, a página simplesmente não existe.
   *
   * Um 403 confirmaria que há um painel administrativo neste endereço.
   * `notFound()` devolve a mesma tela que qualquer URL inventada.
   */
  if (!sessao || !pode(sessao.papel, "admin:painel")) notFound();

  // A primeira carga vem do servidor: o painel abre com número na tela, e o
  // polling só atualiza dali em diante.
  const inicial = await painelAdmin(sessao);

  /*
   * Fora do polling de propósito. O painel se atualiza a cada 15 segundos
   * porque cadastro e faturamento mudam durante o dia; isto aqui é insumo
   * de uma decisão que se toma uma vez por mês, e pedir de novo a cada
   * quinze segundos seria consulta sem leitor.
   */
  const termos = await buscasSemResultado(sessao);

  return (
    <PageShell width="wide">
      <PageTitle
        title="Painel"
        accent="text-warn"
        description="Cadastros, faturamento e distribuição por bairro em Sinop."
      />
      <PainelCliente inicial={inicial} />
      <BuscasSemResultado termos={termos} dias={DIAS_DA_JANELA} />
    </PageShell>
  );
}
