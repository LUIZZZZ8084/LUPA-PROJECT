import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BackLink,
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  APPLICATION_LABELS_CANDIDATO,
  APPLICATION_TONE,
} from "@/lib/constants";
import { getMyApplications } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";

export const metadata: Metadata = {
  title: "Minhas candidaturas",
};

export default async function MinhasCandidaturasPage() {
  const sessao = await sessaoAtual();

  // O muro de login já barra quem não tem sessão; a página não depende
  // disso, para que "sem sessão" continue certo se aquele muro mudar.
  if (!sessao) notFound();

  const candidaturas = await getMyApplications(sessao.usuarioId);

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar ao perfil" />
      <PageTitle
        title="Minhas candidaturas"
        accent="text-vagas"
        description="O status muda conforme a empresa avança no processo."
      />

      {candidaturas.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="Você ainda não se candidatou a nenhuma vaga"
          description="Quando se candidatar, o status aparece aqui."
          action={
            <ButtonLink href="/vagas" variant="vagas" size="sm">
              Ver vagas
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
          {candidaturas.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.job_title}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {c.company_name} · {timeAgo(c.created_at)}
                </p>
              </div>
              <Badge tone={APPLICATION_TONE[c.status]}>
                {APPLICATION_LABELS_CANDIDATO[c.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
