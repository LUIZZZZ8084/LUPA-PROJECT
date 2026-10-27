import { BellRing, Check, Infinity as Infinito, Ticket } from "lucide-react";
import { notFound } from "next/navigation";
import { Carrossel } from "@/components/carrossel";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { formatPrecoBRL } from "@/lib/format";
import {
  OPCAO_AVULSA,
  PLANOS_DE_VAGA,
  resumoDoDireito,
} from "@/lib/planos-empresa";
import { cn } from "@/lib/utils";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { usuarioDaSessao } from "@/server/auth/servico";
import { direitoDePublicar } from "@/server/carteiras/servico";
import { publicoQuePediuAviso } from "@/server/notificacoes/servico";
import {
  PRECO_CENTAVOS,
  VAGAS_NO_AR_POR_PLANO,
} from "@/server/pagamentos/planos";
import { planoDeVagasAtual } from "@/server/pagamentos/servico";
import type { TipoPagamento } from "@/server/pagamentos/tipos";
import type { AreaDeContratacao } from "./area";
import { CancelarPlanoButton } from "./cancelar-plano-button";
import { ComprarButton } from "./comprar-button";

function preco(tipo: TipoPagamento): string {
  return formatPrecoBRL(PRECO_CENTAVOS[tipo] / 100);
}

/** O que cada vaga do plano custa, para a comparação não depender de conta. */
function precoPorVaga(tipo: TipoPagamento): string | null {
  const limite = VAGAS_NO_AR_POR_PLANO[tipo];
  if (!limite) return null;
  return formatPrecoBRL(PRECO_CENTAVOS[tipo] / 100 / limite);
}

function quantasVagas(tipo: TipoPagamento): string {
  const limite = VAGAS_NO_AR_POR_PLANO[tipo];
  return limite === null || limite === undefined
    ? "Quantas vagas quiser no ar, sem contar"
    : `Até ${limite} vagas no ar ao mesmo tempo`;
}

export async function ComprarVagas({ area }: { area: AreaDeContratacao }) {
  const sessao = await sessaoOuEntrar(`${area.base}/creditos`);
  if (!pode(sessao.papel, "vaga:publicar")) notFound();

  const usuario = await usuarioDaSessao(sessao.usuarioId);
  const [direito, planoAtual, publico] = await Promise.all([
    direitoDePublicar(sessao.usuarioId),
    planoDeVagasAtual(sessao),
    usuario?.cidade ? publicoQuePediuAviso(usuario.cidade) : null,
  ]);

  const resumo = resumoDoDireito(direito);
  const validaAte = direito.mensalidadeValidaAte
    ? new Date(direito.mensalidadeValidaAte).toLocaleDateString("pt-BR")
    : null;

  return (
    <PageShell width="narrow">
      <BackLink href={area.base} label="Voltar ao painel" />
      <PageTitle
        title="Planos e vagas"
        accent="text-empresas"
        description="Cada vaga publicada fica 30 dias no ar. Assine um plano para contratar todo mês, ou compre uma vaga avulsa."
      />

      {/*
        O que a pessoa tem vem primeiro, antes dos preços: quem já tem
        plano ou saldo veio aqui por engano e precisa saber disso antes de
        comprar de novo.
      */}
      <Panel className="mb-5">
        <div className="flex items-center gap-3">
          {direito.mensalAtivo ? (
            <Infinito size={20} className="flex-none text-empresas" />
          ) : (
            <Ticket size={20} className="flex-none text-empresas" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm">{resumo.titulo}</p>
            <p className="mt-0.5 text-muted text-sm leading-relaxed">
              {resumo.detalhe}
            </p>
            {direito.mensalAtivo && validaAte && (
              <p className="mt-0.5 text-muted text-sm leading-relaxed">
                {planoAtual
                  ? `Renova por volta de ${validaAte}.`
                  : `Vale até ${validaAte}, e não renova mais.`}
              </p>
            )}
            {direito.mensalAtivo && direito.creditos > 0 && (
              <p className="mt-0.5 text-muted text-sm leading-relaxed">
                Você também tem {direito.creditos}{" "}
                {direito.creditos === 1 ? "vaga avulsa" : "vagas avulsas"}{" "}
                guardada{direito.creditos === 1 ? "" : "s"}.
              </p>
            )}
          </div>
        </div>

        {planoAtual && validaAte && (
          <CancelarPlanoButton validaAte={validaAte} />
        )}
      </Panel>

      {/*
        O público aparece só quando há gente suficiente para o número ser
        verdade e não identificar ninguém (`MINIMO_DO_PUBLICO`). Abaixo
        disso a tela não diz nada, em vez de dizer "3 pessoas".
      */}
      {publico !== null && usuario?.cidade && (
        <Panel className="mb-5">
          <div className="flex items-start gap-3">
            <BellRing size={20} className="mt-0.5 flex-none text-empresas" />
            <p className="text-muted text-sm leading-relaxed">
              <strong className="text-ink">
                {publico.toLocaleString("pt-BR")} pessoas em {usuario.cidade}
              </strong>{" "}
              pediram para ser avisadas de vaga nova. A sua chega no celular
              delas assim que for publicada.
            </p>
          </div>
        </Panel>
      )}

      {/*
        As quatro opções são cards num carrossel (#503), e não uma lista: no
        celular a pessoa comparava preço rolando por quatro painéis altos e
        perdia de vista o anterior ao chegar no próximo.

        A avulsa vem primeiro (#501) e continua distinta dos planos: não
        renova, não vira plano, e vale para quem tem uma vaga só. Ela diz
        "compra única" no lugar de "por mês", porque no mesmo carrossel
        misturá-la faria parecer "o plano de 1", e quem contrata todo mês
        pagaria mais por vaga sem perceber.
      */}
      <Carrossel rotulo="Opções de vaga e plano">
        <Panel className="flex h-full flex-col">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-base">{OPCAO_AVULSA.nome}</h2>
              <Badge tone="outline">Compra única</Badge>
            </div>
            <p className="mt-0.5 text-muted text-sm">{OPCAO_AVULSA.paraQuem}</p>

            <p className="mt-4 font-bold text-empresas text-2xl">
              {preco(OPCAO_AVULSA.tipo)}
            </p>
            <p className="text-faint text-xs">compra única</p>

            <ul className="mt-3 space-y-1.5 text-muted text-sm">
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 flex-none text-empresas" />
                Uma vaga, 30 dias no ar
              </li>
              <li className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 flex-none text-empresas" />
                Paga uma vez, sem renovar
              </li>
            </ul>
          </div>

          <ComprarButton
            tipo={OPCAO_AVULSA.tipo}
            rotulo="Comprar 1 vaga"
            destaque={false}
          />
        </Panel>

        {PLANOS_DE_VAGA.map((plano) => {
          const porVaga = precoPorVaga(plano.tipo);
          const ehOAtual = planoAtual?.tipo === plano.tipo;

          return (
            <Panel
              key={plano.tipo}
              className={cn(
                "flex h-full flex-col",
                plano.destaque && "border-empresas/40",
              )}
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-base">{plano.nome}</h2>
                  {plano.destaque && (
                    <Badge tone="empresas">Mais completo</Badge>
                  )}
                  {ehOAtual && <Badge tone="vagas">Seu plano</Badge>}
                </div>
                <p className="mt-0.5 text-muted text-sm">{plano.paraQuem}</p>

                <p className="mt-4 font-bold text-empresas text-2xl">
                  {preco(plano.tipo)}
                </p>
                <p className="text-faint text-xs">
                  {porVaga ? `por mês · ${porVaga} por vaga` : "por mês"}
                </p>

                <ul className="mt-3 space-y-1.5 text-muted text-sm">
                  <li className="flex items-start gap-2">
                    <Check
                      size={15}
                      className="mt-0.5 flex-none text-empresas"
                    />
                    {quantasVagas(plano.tipo)}
                  </li>
                  {porVaga && (
                    <li className="flex items-start gap-2">
                      <Check
                        size={15}
                        className="mt-0.5 flex-none text-empresas"
                      />
                      Encerrou uma vaga? O lugar dela volta na hora
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <Check
                      size={15}
                      className="mt-0.5 flex-none text-empresas"
                    />
                    Renova sozinho todo mês, e você cancela quando quiser
                  </li>
                </ul>
              </div>

              {/*
                Com um plano ativo, assinar outro só recusaria depois do
                clique. A tela diz o caminho em vez de oferecer o botão:
                cancelar a renovação do atual, no bloco de cima.
              */}
              {!planoAtual && (
                <ComprarButton
                  tipo={plano.tipo}
                  rotulo={`Assinar ${plano.nome}`}
                  destaque
                />
              )}
              {ehOAtual && (
                <p className="mt-3 text-faint text-xs">
                  Este é o plano que você tem agora.
                </p>
              )}
            </Panel>
          );
        })}
      </Carrossel>

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
              O plano limita quantas vagas estão no ar ao mesmo tempo.
            </strong>{" "}
            Vaga encerrada ou vencida libera o lugar. Reativar uma vencida conta
            como publicar de novo.
          </li>
          <li>
            <strong className="text-ink">
              Cancelar não tira os dias que você já pagou.
            </strong>{" "}
            O plano segue valendo até o fim do período. Para trocar de plano,
            cancele a renovação do atual e assine o novo.
          </li>
          <li>
            <strong className="text-ink">
              A vaga avulsa não expira, e não renova.
            </strong>{" "}
            Comprou uma e não usou? Ela fica esperando. Se você tem plano, a
            avulsa só é usada quando o plano está cheio.
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
