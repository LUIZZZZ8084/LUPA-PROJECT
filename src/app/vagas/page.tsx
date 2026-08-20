import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { JobCard } from "@/components/job-card";
import { EmptyState, PageShell, PageTitle } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { CITIES, CONTRACT_TYPES, JOB_CATEGORIES } from "@/lib/constants";
import { getJobs } from "@/lib/data";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Vagas de emprego em Sinop",
  description:
    "Vagas CLT, estágio e temporárias em Sinop-MT, filtradas por categoria, bairro e tipo de contrato.",
};

export default async function VagasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const filters = {
    city: single("cidade") ?? "Sinop",
    category: single("categoria"),
    contract_type: single("tipo"),
    q: single("q"),
  };

  const jobs = await getJobs(filters);

  return (
    <PageShell>
      <PageTitle
        title="Vagas"
        accent="text-vagas"
        description="Emprego formal em Sinop e região, direto de quem está contratando."
      />

      <Suspense fallback={<div className="mb-5 h-24" />}>
        <FilterBar
          accent="vagas"
          searchPlaceholder="Buscar vaga, cargo ou empresa..."
          filters={[
            {
              key: "cidade",
              placeholder: "Sinop - MT",
              locked: true,
              options: CITIES.filter((c) => c.active).map((c) => ({
                value: c.name,
                label: `${c.name} - ${c.state}`,
              })),
            },
            {
              key: "categoria",
              placeholder: "Categoria",
              options: JOB_CATEGORIES.map((c) => ({ value: c, label: c })),
            },
            {
              key: "tipo",
              placeholder: "Tipo",
              options: CONTRACT_TYPES.map((c) => ({ value: c, label: c })),
            },
          ]}
        />
      </Suspense>

      <p className="mb-3 text-xs text-muted">
        {pluralize(jobs.length, "vaga encontrada", "vagas encontradas")}
      </p>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<SearchX size={22} />}
          title="Nenhuma vaga com esses filtros"
          description="Tente remover um filtro ou buscar por outro cargo. Novas vagas entram todo dia."
          action={
            <ButtonLink href="/vagas" variant="outline" size="sm">
              Limpar busca
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
