import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL, passouDoPrazo } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";
import { repositorioUsuarios } from "@/server/repositories";
import { AssinarButton } from "./assinar-button";

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

  const ate = perfil.mensalidadeValidaAte;
  const ativa = Boolean(ate) && !passouDoPrazo(ate as string);
  const preco = formatPrecoBRL(PRECO_CENTAVOS.prestador_mensalidade / 100);

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
              <Badge tone={ativa ? "vagas" : "neutral"}>
                {ativa ? "Ativa" : "Inativa"}
              </Badge>
            </div>

            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {ativa ? (
                <>
                  Válida até{" "}
                  <strong className="text-ink">
                    {new Date(ate as string).toLocaleDateString("pt-BR")}
                  </strong>
                  . Sem ela, o perfil some da busca de{" "}
                  <span className="font-medium">/servicos</span> — os dados
                  continuam salvos, e reativar é só assinar de novo.
                </>
              ) : (
                <>
                  Sem mensalidade ativa, seu perfil não aparece na busca de quem
                  procura profissional. Assinar leva menos de um minuto.
                </>
              )}
            </p>

            <p className="mt-3 text-2xl font-bold text-servicos">
              {preco}
              <span className="ml-1 text-sm font-normal text-muted">/mês</span>
            </p>

            <AssinarButton renovar={ativa} />
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
