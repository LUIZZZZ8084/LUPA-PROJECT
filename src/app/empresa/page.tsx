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
import { APPLICATION_LABELS } from "@/lib/constants";
import {
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
  getCompanyStats,
  getDemoCompanyId,
} from "@/lib/data";
import { pluralize, timeAgo } from "@/lib/format";
import type { ApplicationStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Minha Empresa",
  description: "Publique vagas, receba currículos e acompanhe visualizações.",
};

const STATUS_TONE: Record<
  ApplicationStatus,
  "vagas" | "servicos" | "empresas" | "warn" | "danger" | "neutral"
> = {
  enviada: "servicos",
  visualizada: "neutral",
  entrevista: "warn",
  aprovada: "vagas",
  rejeitada: "danger",
};

export default async function EmpresaPage() {
  const companyId = getDemoCompanyId();
  const [company, jobs, applications, stats] = await Promise.all([
    getCompany(companyId),
    getCompanyJobs(companyId),
    getCompanyApplications(companyId),
    getCompanyStats(companyId),
  ]);

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
            label="Visualizações"
            value={stats.views.toLocaleString("pt-BR")}
          />
        </div>
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
              <li key={job.id}>
                <Link
                  href={`/vagas/${job.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-panel-2"
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
                <Badge tone={STATUS_TONE[app.status]}>
                  {APPLICATION_LABELS[app.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
