import {
  Banknote,
  Briefcase,
  Building2,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ApplyButton } from "@/components/apply-button";
import { JobCard } from "@/components/job-card";
import { BackLink, PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { VerifiedMark } from "@/components/verified-badge";
import { getJobById, getRelatedJobs } from "@/lib/data";
import { formatSalaryRange, pluralize, timeAgo } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { contarVisualizacao } from "@/server/visualizacoes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return { title: "Vaga não encontrada" };
  return {
    title: `${job.title} — ${job.company.company_name}`,
    description: job.description.slice(0, 155),
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) notFound();

  /*
   * A contagem sai por `after()`, depois da resposta: quem abriu a vaga
   * quer ler a vaga, e o número é do outro lado do balcão. Sem isso, o
   * insert entraria no caminho crítico de uma página que muita gente abre
   * em 3G.
   *
   * A própria empresa não conta. Ela abre a vaga para conferir o texto, e
   * uma métrica que sobe quando o dono recarrega mede o dono, não o
   * público.
   */
  const sessao = await sessaoAtual();
  if (sessao?.usuarioId !== job.company_id) {
    after(() => contarVisualizacao(job.id));
  }

  const related = await getRelatedJobs(job);

  return (
    <PageShell width="narrow">
      <BackLink href="/vagas" label="Voltar para vagas" />

      <Panel>
        <div className="flex items-start gap-4">
          <Avatar
            name={job.company.company_name}
            src={job.company.logo_url}
            size="lg"
            square
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-bold sm:text-2xl">
              {job.title}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
              <Building2 size={14} />
              {job.company.company_name}
              {job.company.doc_verified && <VerifiedMark size={14} />}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact
            icon={<Banknote size={15} />}
            label="Salário"
            value={formatSalaryRange(job.salary_min, job.salary_max)}
            accent="text-vagas"
          />
          <Fact
            icon={<MapPin size={15} />}
            label="Local"
            value={
              job.neighborhood ? `${job.neighborhood}, ${job.city}` : job.city
            }
          />
          <Fact
            icon={<Briefcase size={15} />}
            label="Contrato"
            value={job.contract_type ?? "A combinar"}
          />
          <Fact
            icon={<Clock size={15} />}
            label="Publicada"
            value={timeAgo(job.created_at)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {job.category && <Badge tone="vagas">{job.category}</Badge>}
          <Badge tone="outline">
            <Users size={11} />
            {pluralize(job.applicant_count, "candidato", "candidatos")}
          </Badge>
          {job.status === "fechada" && (
            <Badge tone="danger">Vaga fechada</Badge>
          )}
        </div>

        {job.address && (
          <div className="mt-6 border-t border-line pt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <MapPin size={15} className="text-vagas" />
              Endereço
            </h2>
            <p className="text-sm text-muted">{job.address}</p>
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <h2 className="mb-3 text-sm font-semibold">Sobre a vaga</h2>
          <div className="space-y-3 text-sm leading-relaxed text-muted">
            {job.description.split("\n\n").map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          {job.status === "aberta" ? (
            <ApplyButton jobId={job.id} />
          ) : (
            <p className="text-center text-sm text-muted">
              Esta vaga não está mais recebendo candidaturas.
            </p>
          )}
        </div>
      </Panel>

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">Vagas parecidas</h2>
          <div className="space-y-2.5">
            {related.map((r) => (
              <JobCard key={r.id} job={r} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}

function Fact({
  icon,
  label,
  value,
  accent = "text-ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel-2 p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        {icon}
        {label}
      </p>
      <p className={`mt-1 text-[13px] font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
