import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, PageShell, PageTitle } from "@/components/layout/page-shell";
import { ProviderCard } from "@/components/provider-card";
import { ButtonLink } from "@/components/ui/button";
import { CITIES, SERVICE_CATEGORIES } from "@/lib/constants";
import { getProviders } from "@/lib/data";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Profissionais e serviços em Sinop",
  description:
    "Eletricista, diarista, pintor, encanador e mais em Sinop-MT. Perfis verificados, avaliações reais e contato direto no WhatsApp.",
};

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const minRating = single("avaliacao");

  const providers = await getProviders({
    city: single("cidade") ?? "Sinop",
    category: single("categoria"),
    min_rating: minRating ? Number(minRating) : undefined,
    q: single("q"),
  });

  return (
    <PageShell>
      <PageTitle
        title="Serviços"
        accent="text-servicos"
        description="Profissionais da sua região, com avaliação e verificação de documento."
      />

      <FilterBar
        accent="servicos"
        searchPlaceholder="Buscar eletricista, diarista, pintor..."
        values={{
          cidade: single("cidade"),
          categoria: single("categoria"),
          avaliacao: minRating,
          q: single("q"),
        }}
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
            options: SERVICE_CATEGORIES.map((c) => ({
              value: c.slug,
              label: c.name,
            })),
          },
          {
            key: "avaliacao",
            placeholder: "Avaliação",
            options: [
              { value: "4.5", label: "4,5+ estrelas" },
              { value: "4", label: "4,0+ estrelas" },
              { value: "3", label: "3,0+ estrelas" },
            ],
          },
        ]}
      />

      <p className="mb-3 text-xs text-muted">
        {pluralize(
          providers.length,
          "profissional encontrado",
          "profissionais encontrados",
        )}
      </p>

      {providers.length === 0 ? (
        <EmptyState
          icon={<SearchX size={22} />}
          title="Nenhum profissional com esses filtros"
          description="Tente outra categoria ou baixe a exigência de nota. A base cresce toda semana."
          action={
            <ButtonLink href="/servicos" variant="outline" size="sm">
              Limpar busca
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.profile_id} provider={provider} />
          ))}
        </div>
      )}

      <div className="mt-8 rounded-[var(--radius-panel)] border border-servicos/25 bg-gradient-to-br from-servicos/8 to-transparent p-5 text-center">
        <p className="font-semibold">Você presta algum desses serviços?</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          Criar perfil na Lupa é gratuito. Apareça para quem está procurando
          na sua região.
        </p>
        <ButtonLink
          href="/cadastro?tipo=prestador_servico"
          variant="servicos"
          size="sm"
          className="mt-4"
        >
          Criar meu perfil
        </ButtonLink>
      </div>
    </PageShell>
  );
}
