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

  const { assinatura, emTesteGratis } = await estadoDaAssinatura(sessao);

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
              <Badge
                tone={emTesteGratis ? "servicos" : emDia ? "vagas" : "neutral"}
              >
                {emTesteGratis ? "Teste grátis" : emDia ? "Ativa" : "Inativa"}
              </Badge>
            </div>

            {/*
              Cada estado diz três coisas, na mesma ordem: onde a pessoa
              está, o que acontece sozinho, e o que ela faz se não quiser.
              Sem isso a mesma tela já confundiu — "nada é devolvido" para
              quem ainda não pagou nada soa como ameaça.
            */}
            <div className="mt-1.5 space-y-2 text-muted text-sm leading-relaxed">
              {emTesteGratis ? (
                <>
                  <p>
                    Seu perfil já está na busca, e{" "}
                    <strong className="text-ink">
                      você ainda não pagou nada
                    </strong>
                    .
                  </p>
                  <p>
                    O teste vai até{" "}
                    <strong className="text-ink">{validaAte}</strong>. Se não
                    cancelar até essa data, cobramos {preco} no seu cartão e a
                    assinatura passa a renovar todo mês. Cancelando antes,{" "}
                    <strong className="text-ink">não é cobrado nada</strong>.
                  </p>
                </>
              ) : renova ? (
                <p>
                  Renova sozinha todo mês. A próxima cobrança de {preco} sai por
                  volta de <strong className="text-ink">{validaAte}</strong>, e
                  você pode cancelar quando quiser.
                </p>
              ) : cartaoRecusado ? (
                <p>
                  O Mercado Pago não conseguiu cobrar a última mensalidade — em
                  geral é o cartão. Assine de novo para voltar a aparecer na
                  busca.
                </p>
              ) : comecouENaoTerminou ? (
                <p>
                  Você começou e não terminou. Continue de onde parou para
                  autorizar o cartão e começar os {DIAS_TESTE_GRATIS} dias de
                  teste.
                </p>
              ) : emDia ? (
                <p>
                  Sua mensalidade vale até{" "}
                  <strong className="text-ink">{validaAte}</strong>, e{" "}
                  <strong className="text-ink">não renova sozinha</strong>.
                  Depois dessa data o perfil sai da busca — os dados continuam
                  salvos.
                </p>
              ) : (
                <>
                  <p>
                    Sem assinatura, seu perfil{" "}
                    <strong className="text-ink">não aparece na busca</strong>{" "}
                    de quem procura profissional.
                  </p>
                  <p>
                    Você autoriza o cartão e testa{" "}
                    <strong className="text-ink">
                      {DIAS_TESTE_GRATIS} dias grátis
                    </strong>
                    . A primeira cobrança de {preco} só acontece depois disso —
                    e se cancelar antes, não pagou nada.
                  </p>
                </>
              )}
            </div>

            <p className="mt-3 font-bold text-2xl text-servicos">
              {preco}
              <span className="ml-1 font-normal text-muted text-sm">/mês</span>
            </p>

            {renova && validaAte ? (
              <CancelarRenovacaoButton
                validaAte={validaAte}
                emTesteGratis={emTesteGratis}
              />
            ) : (
              <AssinarButton
                rotulo={
                  comecouENaoTerminou
                    ? "Continuar"
                    : emDia
                      ? "Ativar renovação automática"
                      : `Testar ${DIAS_TESTE_GRATIS} dias grátis`
                }
              />
            )}
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
