import { FileText, Inbox, Plus } from "lucide-react";
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
import { pluralize, timeAgo } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  serieDoPainel,
  temPainelDeEmpresa,
  totaisDaSerie,
} from "@/server/visualizacoes/servico";
import { EncerrarVagaButton } from "./encerrar-vaga-button";
import { MoverCandidaturaSelect } from "./mover-candidatura-select";
import { SerieGrafico } from "./serie-grafico";

export const metadata: Metadata = {
  title: "Minha Empresa",
  description: "Publique vagas, receba currículos e acompanhe visualizações.",
};

export default async function EmpresaPage() {
  const sessao = await sessaoAtual();
  const companyId = empresaDoPainel(sessao?.usuarioId ?? null);
  const [company, jobs, applications, stats, serie] = await Promise.all([
    getCompany(companyId),
    getCompanyJobs(companyId),
    getCompanyApplications(companyId),
    getCompanyStats(companyId),
    // Quem não é empresa cai no estado vazio logo abaixo; pedir a série
    // antes disso trocaria a explicação por uma tela de erro.
    temPainelDeEmpresa(sessao) ? serieDoPainel(sessao) : [],
  ]);
  const totais = totaisDaSerie(serie);

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
          <ButtonLink href="/empresa/vagas/nova" variant="empresas">
            <Plus size={17} />
            Publicar nova vaga
          </ButtonLink>
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
              <li key={app.id} className="flex items-center gap-3 p-4">
                <Avatar name={app.candidate.full_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
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
                <MoverCandidaturaSelect id={app.id} statusAtual={app.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
