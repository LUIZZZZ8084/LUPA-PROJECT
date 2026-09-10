import { Check, Infinity as Infinito, Ticket } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import { OPCOES_DE_VAGA } from "@/lib/planos-empresa";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { direitoDePublicar } from "@/server/carteiras/servico";
import {
  CREDITOS_POR_COMPRA,
  PRECO_CENTAVOS,
} from "@/server/pagamentos/planos";
import type { TipoPagamento } from "@/server/pagamentos/tipos";
import { ComprarButton } from "./comprar-button";

export const metadata: Metadata = {
  title: "Comprar vagas",
};

function precoPorVaga(tipo: TipoPagamento): string {
  const creditos = CREDITOS_POR_COMPRA[tipo] ?? 1;
  return formatPrecoBRL(PRECO_CENTAVOS[tipo] / 100 / creditos);
}

export default async function CreditosPage() {
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "vaga:publicar")) notFound();

  const direito = await direitoDePublicar(sessao.usuarioId);
  const mensal = formatPrecoBRL(PRECO_CENTAVOS.empresa_mensal / 100);

  return (
    <PageShell width="narrow">
      <BackLink href="/empresa" label="Voltar ao painel" />
      <PageTitle
        title="Comprar vagas"
        accent="text-empresas"
        description="Cada vaga publicada fica 30 dias no ar. Você compra quantas quiser, e elas não expiram."
      />

      {/*
        O saldo vem primeiro, antes dos preços: quem já tem crédito veio
        aqui por engano e precisa saber disso antes de comprar de novo.
      */}
      <Panel className="mb-5">
        <div className="flex items-center gap-3">
          {direito.mensalAtivo ? (
            <Infinito size={20} className="flex-none text-empresas" />
          ) : (
            <Ticket size={20} className="flex-none text-empresas" />
          )}
          <div className="min-w-0 flex-1">
            {direito.mensalAtivo ? (
              <>
                <p className="font-bold text-sm">Seu plano mensal está ativo</p>
                <p className="mt-0.5 text-muted text-sm leading-relaxed">
                  Publique quantas vagas quiser até{" "}
                  {new Date(
                    direito.mensalidadeValidaAte as string,
                  ).toLocaleDateString("pt-BR")}
                  , sem tirar nada do saldo.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm">
                  {direito.creditos === 0
                    ? "Você não tem vagas para publicar"
                    : direito.creditos === 1
                      ? "Você tem 1 vaga para publicar"
                      : `Você tem ${direito.creditos} vagas para publicar`}
                </p>
                <p className="mt-0.5 text-muted text-sm leading-relaxed">
                  {direito.creditos === 0
                    ? "Compre abaixo para publicar sua primeira vaga."
                    : "Cada uma fica 30 dias no ar."}
                </p>
              </>
            )}
          </div>
        </div>
      </Panel>

      <div className="space-y-3">
        {OPCOES_DE_VAGA.map((opcao) => (
          <Panel
            key={opcao.tipo}
            className={opcao.destaque ? "border-empresas/40" : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-base">{opcao.nome}</h2>
                  {opcao.destaque && (
                    <Badge tone="empresas">Melhor preço</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-muted text-sm">{opcao.paraQuem}</p>
              </div>
              <div className="flex-none text-right">
                <p className="font-bold text-empresas text-xl">
                  {formatPrecoBRL(PRECO_CENTAVOS[opcao.tipo] / 100)}
                </p>
                <p className="text-faint text-xs">
                  {precoPorVaga(opcao.tipo)} por vaga
                </p>
              </div>
            </div>

            <ComprarButton
              tipo={opcao.tipo}
              rotulo={`Comprar ${opcao.nome.toLowerCase()}`}
              destaque={Boolean(opcao.destaque)}
            />
          </Panel>
        ))}

        {/*
          O mensal fica separado porque não é a mesma coisa que os outros
          três: não vira crédito, e para de valer se a pessoa cancelar.
          Misturá-lo na lista faria parecer "o pacote maior", e quem
          publica duas vagas por ano assinaria sem precisar.
        */}
        <Panel className="border-empresas/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-base">Vagas ilimitadas</h2>
                <Badge tone="empresas">Mensal</Badge>
              </div>
              <p className="mt-0.5 text-muted text-sm">
                Para quem contrata todo mês e não quer ficar contando.
              </p>
            </div>
            <div className="flex-none text-right">
              <p className="font-bold text-empresas text-xl">{mensal}</p>
              <p className="text-faint text-xs">por mês</p>
            </div>
          </div>

          <ul className="mt-3 space-y-1.5 text-muted text-sm">
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-empresas" />
              Publique quantas vagas quiser, sem tirar do saldo
            </li>
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-empresas" />
              Renova sozinho todo mês, e você cancela quando quiser
            </li>
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-empresas" />
              As vagas que você já comprou continuam guardadas
            </li>
          </ul>

          <ComprarButton
            tipo="empresa_mensal"
            rotulo={
              direito.mensalAtivo ? "Plano já ativo" : "Assinar o plano mensal"
            }
            destaque
          />
        </Panel>
      </div>

      <Panel className="mt-5">
        <h2 className="font-bold text-sm">Como funciona</h2>
        <ul className="mt-2 space-y-1.5 text-muted text-sm leading-relaxed">
          <li>
            <strong className="text-ink">Cada vaga fica 30 dias no ar.</strong>{" "}
            Depois disso ela sai da busca — quem procura emprego não perde tempo
            com vaga que já foi preenchida.
          </li>
          <li>
            <strong className="text-ink">
              Reativar uma vaga vencida gasta outra do saldo.
            </strong>{" "}
            É o mesmo que publicar de novo, e por isso custa o mesmo.
          </li>
          <li>
            <strong className="text-ink">
              O que você compra não expira, e nem recarrega.
            </strong>{" "}
            Comprou 10 e usou 3? As outras 7 ficam esperando. Acabou, é só
            comprar mais — não vira nada sozinho no fim do mês.
          </li>
          <li>
            <strong className="text-ink">
              Depois de publicada, a vaga não pode ser editada.
            </strong>{" "}
            Você confere tudo numa tela de revisão antes de publicar.
          </li>
        </ul>
      </Panel>
    </PageShell>
  );
}
