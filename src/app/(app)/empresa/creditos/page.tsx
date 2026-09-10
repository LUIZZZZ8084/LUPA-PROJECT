import { Check, Infinity as Infinito, Ticket } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
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

/**
 * As quatro opções, na ordem em que fazem sentido para quem está
 * decidindo: da menor para a maior, e o ilimitado por último.
 *
 * Cada uma diz o preço **por vaga** — sem isso não há como comparar
 * R$ 119,90 por 5 com R$ 149,90 por 10, e uma tabela de preços que não
 * deixa comparar é uma tabela que faz a pessoa escolher errado e se
 * arrepender.
 */
const OPCOES: {
  tipo: TipoPagamento;
  nome: string;
  paraQuem: string;
  destaque?: boolean;
}[] = [
  {
    tipo: "empresa_vaga_avulsa",
    nome: "1 vaga",
    paraQuem: "Para quem tem uma vaga só, agora.",
  },
  {
    tipo: "empresa_pacote_5",
    nome: "5 vagas",
    paraQuem: "Para quem contrata algumas vezes por ano.",
  },
  {
    tipo: "empresa_pacote_10",
    nome: "10 vagas",
    paraQuem: "Para quem contrata o ano inteiro.",
    destaque: true,
  },
];

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
        description="Cada vaga publicada fica 30 dias no ar. Você compra quantas quiser, e os créditos não expiram."
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
                  , sem gastar crédito.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-sm">
                  {direito.creditos === 0
                    ? "Você não tem créditos"
                    : direito.creditos === 1
                      ? "Você tem 1 crédito"
                      : `Você tem ${direito.creditos} créditos`}
                </p>
                <p className="mt-0.5 text-muted text-sm leading-relaxed">
                  {direito.creditos === 0
                    ? "Compre abaixo para publicar sua primeira vaga."
                    : "Cada crédito publica uma vaga por 30 dias."}
                </p>
              </>
            )}
          </div>
        </div>
      </Panel>

      <div className="space-y-3">
        {OPCOES.map((opcao) => (
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
                Para quem contrata todo mês e não quer contar crédito.
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
              Publique quantas vagas quiser, sem gastar crédito
            </li>
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-empresas" />
              Renova sozinho todo mês, e você cancela quando quiser
            </li>
            <li className="flex items-start gap-2">
              <Check size={15} className="mt-0.5 flex-none text-empresas" />
              Os créditos que você já tem continuam guardados
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
              Reativar uma vaga vencida usa um crédito.
            </strong>{" "}
            É o mesmo que publicar de novo, e por isso custa o mesmo.
          </li>
          <li>
            <strong className="text-ink">Crédito não expira.</strong> Comprou 10
            e usou 3? Os outros 7 ficam esperando.
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
