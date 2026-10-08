import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { repositorioPagamentos } from "@/server/pagamentos";
import { RetornoDaCompra } from "./retorno-cliente";

export const metadata: Metadata = {
  title: "Confirmando pagamento",
};

/**
 * A volta do Mercado Pago, para os dois tipos de compra.
 *
 * `?assinatura=` é quem autorizou uma cobrança recorrente, e o que ela
 * espera é a assinatura ficar ativa. `?compra=` é quem pagou uma vez —
 * vaga avulsa ou pacote (#172) —, e o que ela espera é o pagamento ser
 * aprovado. São perguntas diferentes, com rotas diferentes, e por isso a
 * URL diz qual das duas.
 */
export default async function RetornoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ assinatura?: string; compra?: string }>;
}) {
  const { assinatura: idAssinatura, compra: idCompra } = await searchParams;
  const sessao = await sessaoOuEntrar(
    idAssinatura
      ? `/pagamento/retorno?assinatura=${idAssinatura}`
      : `/pagamento/retorno?compra=${idCompra ?? ""}`,
  );

  const repo = repositorioPagamentos();

  /*
   * Mesma regra de "não encontrado" em vez de "sem permissão": id
   * ausente ou recurso de outra pessoa recebem o mesmo 404, sem confirmar
   * qual dos dois aconteceu. Sessão ausente vai ao login (#330), e volta
   * aqui depois.
   */
  const alvo = idAssinatura
    ? await repo.assinaturaPorId(idAssinatura)
    : idCompra
      ? await repo.porId(idCompra)
      : null;

  if (!alvo || alvo.usuarioId !== sessao.usuarioId) {
    notFound();
  }

  return (
    <PageShell width="narrow">
      <PageTitle title={idAssinatura ? "Assinatura" : "Pagamento"} />
      <RetornoDaCompra
        id={alvo.id}
        rota={idAssinatura ? "assinaturas" : "pagamentos"}
        tipo={alvo.tipo}
      />
    </PageShell>
  );
}
