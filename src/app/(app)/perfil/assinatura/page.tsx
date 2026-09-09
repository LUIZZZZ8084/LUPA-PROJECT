import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL, passouDoPrazo } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { DIAS_TESTE_GRATIS, PRECO_CENTAVOS } from "@/server/pagamentos/planos";
import { estadoDaAssinatura } from "@/server/pagamentos/servico";
import { repositorioUsuarios } from "@/server/repositories";
import { AssinarButton } from "./assinar-button";
import { CancelarRenovacaoButton } from "./cancelar-button";
import { EstornarButton } from "./estornar-button";

export const metadata: Metadata = {
  title: "Assinatura",
};

export default async function AssinaturaPage() {
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "prestador:gerenciar_assinatura")) {
    notFound();
  }

  const perfil = await repositorioUsuarios().perfilPrestador(sessao.usuarioId);
  if (!perfil) notFound();

  /*
   * Quem decide o que a tela oferece é o servidor, não o botão. Mostrar a
   * devolução fora do prazo — ou fora da primeira cobrança — e recusar
   * depois do clique é o "botão que só recusa depois do clique" que este
   * projeto já registra duas vezes.
   */
  const { assinatura, podeEstornar } = await estadoDaAssinatura(sessao);

  const ate = perfil.mensalidadeValidaAte;
  const emDia = Boolean(ate) && !passouDoPrazo(ate as string);
  const validaAte = ate ? new Date(ate).toLocaleDateString("pt-BR") : null;

  const preco = formatPrecoBRL(PRECO_CENTAVOS.prestador_mensalidade / 100);

  const renova = assinatura?.status === "ativa";
  const comecouENaoTerminou = assinatura?.status === "pendente";
  const cartaoRecusado = assinatura?.status === "pausada";

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar para o perfil" />
      <PageTitle
        title="Assinatura"
        description="Mensalidade para o seu perfil aparecer na busca de quem procura profissional."
      />

      <Panel>
        <div className="flex items-start gap-3">
          <CreditCard size={20} className="mt-0.5 flex-none text-servicos" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">Mensalidade de prestador</h2>
              <Badge tone={emDia ? "vagas" : "neutral"}>
                {emDia ? "Ativa" : "Inativa"}
              </Badge>
            </div>

            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {renova ? (
                <>
                  Renova sozinha todo mês. A próxima cobrança sai por volta de{" "}
                  <strong className="text-ink">{validaAte}</strong>, e você pode
                  cancelar quando quiser.
                </>
              ) : cartaoRecusado ? (
                <>
                  O Mercado Pago não conseguiu cobrar a última mensalidade — em
                  geral é o cartão. Assine de novo para voltar a renovar.
                </>
              ) : comecouENaoTerminou ? (
                <>
                  Você começou a assinar e não terminou. Continue de onde parou
                  para autorizar a cobrança mensal.
                </>
              ) : emDia ? (
                <>
                  Sua mensalidade vale até{" "}
                  <strong className="text-ink">{validaAte}</strong>, e{" "}
                  <strong className="text-ink">não renova sozinha</strong>.
                  Depois dessa data o perfil sai da busca de{" "}
                  <span className="font-medium">/servicos</span> — os dados
                  continuam salvos.
                </>
              ) : (
                <>
                  Sem mensalidade ativa, seu perfil não aparece na busca de quem
                  procura profissional. Autorize o cartão e teste{" "}
                  <strong className="text-ink">
                    {DIAS_TESTE_GRATIS} dias grátis
                  </strong>
                  ; se não cancelar antes, cobra sozinho quando o prazo
                  terminar.
                </>
              )}
            </p>

            <p className="mt-3 text-2xl font-bold text-servicos">
              {preco}
              <span className="ml-1 text-sm font-normal text-muted">/mês</span>
            </p>

            {renova && validaAte ? (
              <CancelarRenovacaoButton validaAte={validaAte} />
            ) : (
              <AssinarButton
                rotulo={
                  comecouENaoTerminou
                    ? "Continuar assinatura"
                    : emDia
                      ? "Ativar renovação automática"
                      : `Testar ${DIAS_TESTE_GRATIS} dias grátis`
                }
              />
            )}

            {/*
              A devolução não depende de a renovação estar ligada. Quem
              cancelou no dia seguinte à primeira cobrança e ainda quer o
              dinheiro de volta está dentro da regra — esconder o botão
              ali mandaria essa pessoa ao suporte por nada.
            */}
            {podeEstornar && <EstornarButton />}
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
