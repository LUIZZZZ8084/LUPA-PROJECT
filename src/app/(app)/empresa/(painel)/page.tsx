import { FileText, Inbox, MessageCircle, Plus, UserSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel, Stat } from "@/components/ui/card";
import { VerifiedMark } from "@/components/verified-badge";
import {
  empresaDoPainel,
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
  getCompanyStats,
} from "@/lib/data";
import { pluralize, timeAgo, whatsappLink } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  type MatchDaCandidatura,
  matchPorCandidatura,
} from "@/server/candidaturas/match";
import { recomendadosParaEmpresa } from "@/server/candidaturas/recomendados";
import {
  serieDoPainel,
  temPainelDeEmpresa,
  totaisDaSerie,
} from "@/server/visualizacoes/servico";
import { EncerrarVagaButton } from "../encerrar-vaga-button";
import { MoverCandidaturaSelect } from "../mover-candidatura-select";
import { SerieGrafico } from "../serie-grafico";
import { Recomendados } from "./recomendados";

export const metadata: Metadata = {
  title: "Minha Empresa",
  description: "Publique vagas, receba currículos e acompanhe visualizações.",
};

/**
 * O quanto o candidato casa com a vaga a que se candidatou.
 *
 * Sem match no mapa, não desenha nada: a vaga não declarou habilidade e o
 * título não deu pista. Mostrar "0%" ali seria afirmar que o candidato não
 * tem nada do que se pede, quando a verdade é que ninguém disse o que se
 * pede.
 *
 * O número vive no `aria-label` por extenso porque o selo mostra só
 * "72%", e "72%" sozinho não diz de quê — nem para quem usa leitor de
 * tela, nem para quem está no celular, onde `title` não existe. Quem
 * quiser o detalhe abre a ficha.
 */
function SeloDeMatch({ match }: { match: MatchDaCandidatura | undefined }) {
  if (!match) return null;

  const tone =
    match.porcentagem >= 70
      ? "vagas"
      : match.porcentagem >= 40
        ? "warn"
        : "neutral";

  return (
    <Badge
      tone={tone}
      className="flex-none"
      aria-label={`Combina com ${match.pontos} de ${match.deQuantas} habilidades que a vaga pede`}
    >
      {match.porcentagem}%
    </Badge>
  );
}

export default async function EmpresaPage() {
  const sessao = await sessaoAtual();
  const companyId = empresaDoPainel(sessao?.usuarioId ?? null);
  const [company, jobs, applications, stats, serie, recomendados] =
    await Promise.all([
      getCompany(companyId),
      getCompanyJobs(companyId),
      getCompanyApplications(companyId),
      getCompanyStats(companyId),
      // Quem não é empresa cai no estado vazio logo abaixo; pedir a série
      // antes disso trocaria a explicação por uma tela de erro.
      temPainelDeEmpresa(sessao) ? serieDoPainel(sessao) : [],
      recomendadosParaEmpresa(sessao),
    ]);
  const totais = totaisDaSerie(serie);
  const match = matchPorCandidatura(applications, jobs);

  if (!company) {
    return (
      <PageShell>
        <EmptyState
          icon={<Inbox size={22} />}
          title="Nenhuma empresa vinculada a esta conta"
          description="Cadastre sua empresa para publicar vagas em Sinop."
          action={
            <ButtonLink
              href="/cadastro?tipo=empresa"
              variant="empresas"
              size="sm"
            >
              Cadastrar empresa
            </ButtonLink>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageTitle
        title="Minha Empresa"
        accent="text-empresas"
        description="Acompanhe suas vagas e os currículos recebidos."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/candidatos" variant="outline">
              <UserSearch size={17} />
              Candidatos
            </ButtonLink>
            <ButtonLink href="/empresa/vagas/nova" variant="empresas">
              <Plus size={17} />
              Publicar nova vaga
            </ButtonLink>
          </div>
        }
      />

      <Panel>
        <div className="flex items-start gap-4">
          <Avatar
            name={company.company_name}
            src={company.logo_url}
            size="lg"
            square
          />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              {company.company_name}
              <VerifiedMark size={16} />
            </h2>
            <p className="mt-1 text-xs text-muted">
              CNPJ {company.cnpj ?? "não informado"}
            </p>
            <div className="mt-2.5">
              <Badge tone={company.plan === "mensal" ? "empresas" : "outline"}>
                {company.plan === "mensal"
                  ? "Plano mensal ativo"
                  : "Período de teste — 1ª vaga gratuita"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat
            label="Vagas ativas"
            value={stats.active_jobs}
            accent="text-empresas"
          />
          <Stat label="Currículos" value={stats.applications} />
          <Stat
            label="Visualizações (30 dias)"
            value={totais.visualizacoes.toLocaleString("pt-BR")}
          />
        </div>

        <SerieGrafico serie={serie} />
      </Panel>

      {/* Vagas publicadas */}
      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Vagas publicadas</h2>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Você ainda não publicou nenhuma vaga"
            description="A primeira publicação é gratuita. Leva menos de dois minutos."
            action={
              <ButtonLink
                href="/empresa/vagas/nova"
                variant="empresas"
                size="sm"
              >
                <Plus size={16} />
                Publicar vaga
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-panel-2"
              >
                <Link
                  href={`/vagas/${job.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {job.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {pluralize(
                        job.applicant_count,
                        "candidato",
                        "candidatos",
                      )}{" "}
                      · {timeAgo(job.created_at)}
                    </p>
                  </div>
                  <Badge tone={job.status === "aberta" ? "vagas" : "neutral"}>
                    {job.status === "aberta" ? "Ativa" : "Encerrada"}
                  </Badge>
                </Link>
                {job.status === "aberta" && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/empresa/vagas/${job.id}/editar`}
                      className="text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      Editar
                    </Link>
                    <EncerrarVagaButton id={job.id} titulo={job.title} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Recomendados vagas={recomendados} />

      {/* Currículos recebidos */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-bold">Currículos recebidos</h2>
        {applications.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title="Nenhuma candidatura ainda"
            description="Assim que alguém se candidatar às suas vagas, o currículo aparece aqui."
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {applications.map((app) => (
              <li
                key={app.id}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-panel-2"
              >
                {/*
                  A linha inteira abre a ficha: nome, bairro e vaga não
                  bastam para decidir chamar alguém, e antes disto não
                  havia para onde clicar.
                */}
                <Link
                  href={`/empresa/candidaturas/${app.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar
                    name={app.candidate.full_name}
                    src={app.candidate.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold underline-offset-2 group-hover:underline">
                      {app.candidate.full_name}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {app.job_title}
                      {app.candidate.neighborhood
                        ? ` · ${app.candidate.neighborhood}`
                        : ""}
                      {` · ${timeAgo(app.created_at)}`}
                    </p>
                  </div>
                </Link>

                <SeloDeMatch match={match.get(app.id)} />

                {/*
                  Atalho de contato na própria lista: o caminho entre
                  receber o currículo e chamar a pessoa não deveria ter
                  uma tela no meio.
                */}
                {app.candidate.phone && (
                  <a
                    href={whatsappLink(
                      app.candidate.phone,
                      `Olá! Vimos sua candidatura para a vaga de ${app.job_title} na Lupa e gostaríamos de conversar.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Falar com ${app.candidate.full_name} no WhatsApp`}
                    className="flex-none rounded-lg border border-line p-2 text-muted transition-colors hover:border-vagas hover:text-vagas"
                  >
                    <MessageCircle size={16} />
                  </a>
                )}

                <MoverCandidaturaSelect id={app.id} statusAtual={app.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
