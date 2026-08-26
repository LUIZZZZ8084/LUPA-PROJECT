import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { FilterBar } from "@/components/filter-bar";
import { JobCard } from "@/components/job-card";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import {
  CIDADES,
  CONTRACT_TYPES,
  ESTADO,
  JOB_CATEGORIES,
} from "@/lib/constants";
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

  /*
   * Sem cidade na URL, a busca é do estado inteiro — não de Sinop.
   *
   * O `?? "Sinop"` sobrou de quando Sinop era a única cidade. Depois que os
   * 142 municípios entraram, ele passou a esconder daqui toda vaga
   * publicada fora de Sinop: a empresa via a vaga no painel e nos destaques
   * da home — que consulta sem filtro nenhum — e não via na busca, o que
   * parece vaga que não foi publicada.
   *
   * O chip do filtro já anuncia "Todo o MT" enquanto nada está escolhido.
   * `undefined` aqui é o que faz a tela entregar o que ela promete.
   */
  const filters = {
    city: single("cidade"),
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

      <FilterBar
        accent="vagas"
        searchPlaceholder="Buscar vaga, cargo ou empresa..."
        values={{
          cidade: single("cidade"),
          categoria: single("categoria"),
          tipo: single("tipo"),
          q: single("q"),
        }}
        filters={[
          {
            key: "cidade",
            placeholder: "Todo o MT",
            options: CIDADES.map((c) => ({
              value: c,
              label: `${c} - ${ESTADO}`,
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
        <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
