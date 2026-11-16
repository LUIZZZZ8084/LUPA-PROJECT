import { ExternalLink, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnviarVagaNoWhatsApp } from "@/components/compartilhar-vaga";
import {
  BackLink,
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { umParametro } from "@/lib/busca";
import { APPLICATION_LABELS } from "@/lib/constants";
import {
  empresaDoPainel,
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
} from "@/lib/data";
import { pluralize, prazoDaVaga, vagaExpirada } from "@/lib/format";
import {
  contarPorEstagio,
  ESTAGIOS,
  ehEstagio,
} from "@/lib/funil-de-candidaturas";
import { quemContrata } from "@/lib/vaga-confidencial";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { temPainelDeEmpresa } from "@/server/visualizacoes/servico";
import type { AreaDeContratacao } from "./area";
import { montarCardsDoFunil } from "./cards-do-funil";
import { EncerrarVagaButton } from "./encerrar-vaga-button";
import { QuadroDoFunil } from "./quadro-do-funil";
import { ReativarVagaButton } from "./reativar-vaga-button";

/** "10/11/2026", em Brasília: a data não pode mudar com o fuso do servidor. */
function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * O processo seletivo de uma vaga (#612).
 *
 * Até aqui a vaga era uma linha na aba Vagas e um filtro no quadro geral.
 * Quem recruta pensa por vaga: "como está a de operador?". Esta página é a
 * resposta — o estado e o prazo, quantos em cada etapa, as ações da vaga e
 * o quadro só dela.
 *
 * **Só o dono abre.** A vaga é procurada entre as da empresa da sessão: id
 * de outra empresa não está na lista, e a resposta é o mesmo 404 de id que
 * não existe. As candidaturas já vêm filtradas pela empresa.
 *
 * **Sem pausar.** A vaga é aberta ou encerrada, e o limite dos planos conta
 * vagas no ar: pausar liberando o lugar seria rodar mais vagas que o plano,
 * e pausar sem liberar não difere de encerrar e reativar.
 */
export async function ProcessoDaVaga({
  area,
  params,
  searchParams,
}: {
  area: AreaDeContratacao;
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sessao = await sessaoOuEntrar(`${area.base}/vagas/${id}`);
  if (!temPainelDeEmpresa(sessao)) notFound();

  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [empresa, vagas, todas] = await Promise.all([
    getCompany(empresaId),
    getCompanyJobs(empresaId),
    getCompanyApplications(empresaId),
  ]);
  const vaga = vagas.find((v) => v.id === id);
  if (!vaga) notFound();

  const candidaturas = todas.filter((c) => c.job_id === vaga.id);
  const contagem = contarPorEstagio(candidaturas);
  const cards = await montarCardsDoFunil({
    candidaturas,
    todas,
    vagas,
    nomeDaEmpresa: empresa?.company_name ?? "nossa empresa",
  });

  const pedido = umParametro(await searchParams, "estagio");
  const expirada = vaga.status === "aberta" && vagaExpirada(vaga.expires_at);
  const noAr = vaga.status === "aberta" && !expirada;

  return (
    <PageShell width="wide">
      <BackLink href={`${area.base}/vagas`} label="Voltar para as vagas" />
      <PageTitle
        title={vaga.title}
        accent="text-empresas"
        description={`${vaga.city} · Publicada em ${dataCurta(vaga.created_at)}`}
      />

      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={expirada ? "warn" : noAr ? "vagas" : "neutral"}>
            {vaga.removed_at
              ? "Removida pela moderação"
              : expirada
                ? "Expirada"
                : noAr
                  ? "Ativa"
                  : "Encerrada"}
          </Badge>
          {vaga.status === "aberta" && (
            <span className="text-muted text-sm">
              {prazoDaVaga(vaga.expires_at)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-muted text-sm">
            <Users size={15} aria-hidden />
            {pluralize(candidaturas.length, "candidatura", "candidaturas")}
          </span>
        </div>

        {/*
          Quantos em cada etapa, na ordem do funil. É a etapa de agora, não o
          alcance: aqui a pergunta é "onde está cada um?".
        */}
        <ol
          aria-label="Candidatos por etapa"
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
        >
          {ESTAGIOS.map((e) => (
            <li key={e} className="rounded-xl bg-panel-2 px-3 py-2.5">
              <p className="font-bold text-xl tabular-nums leading-none">
                {contagem[e]}
              </p>
              <p className="mt-1 text-muted text-xs">{APPLICATION_LABELS[e]}</p>
            </li>
          ))}
        </ol>

        {/*
          As ações da vaga. Editar e encerrar só no ar; a expirada oferece
          reativar, que custa uma vaga como na aba Vagas. O anúncio abre a
          página pública, que é o que o candidato vê.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-line border-t pt-4">
          <ButtonLink href={`/vagas/${vaga.id}`} variant="outline" size="sm">
            <ExternalLink size={14} aria-hidden />
            Ver anúncio
          </ButtonLink>
          {noAr && (
            <>
              <EnviarVagaNoWhatsApp
                vagaId={vaga.id}
                cargo={vaga.title}
                cidade={vaga.city}
                empresa={quemContrata(vaga)}
              />
              <ButtonLink
                href={`${area.base}/vagas/${vaga.id}/editar`}
                variant="outline"
                size="sm"
              >
                <Pencil size={14} aria-hidden />
                Editar
              </ButtonLink>
              <EncerrarVagaButton id={vaga.id} titulo={vaga.title} />
            </>
          )}
          {expirada && <ReativarVagaButton id={vaga.id} />}
        </div>
      </Panel>

      <h2 className="mb-3 font-bold text-base">Candidatos</h2>
      {candidaturas.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Ninguém se candidatou ainda"
          description={
            noAr
              ? "Divulgue a vaga pelo botão acima: o link abre sem login, e quem se candidatar aparece aqui, na coluna das novas."
              : "Esta vaga não está no ar, então não recebe candidaturas."
          }
        />
      ) : (
        <>
          <QuadroDoFunil
            cards={cards}
            base={area.base}
            estagioInicial={ehEstagio(pedido) ? pedido : "enviada"}
          />
          <p className="mt-3 text-faint text-xs">
            <Link
              href={`${area.base}/funil`}
              className="inline-flex min-h-11 items-center text-empresas underline-offset-2 hover:underline"
            >
              Ver os candidatos de todas as vagas
            </Link>
          </p>
        </>
      )}
    </PageShell>
  );
}
