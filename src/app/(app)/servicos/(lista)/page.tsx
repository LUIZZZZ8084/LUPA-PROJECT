import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import { FilterBar } from "@/components/filter-bar";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { ProviderCard } from "@/components/provider-card";
import { ButtonLink } from "@/components/ui/button";
import { filtrosDeLugar, lugarDaBusca, umParametro } from "@/lib/busca";
import { UFS } from "@/lib/cidades";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { getProviders } from "@/lib/data";
import { pluralize } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { origemDoUsuario } from "@/server/auth/origem";
import { pode } from "@/server/auth/rbac";
import { contarBuscaSemResultado } from "@/server/buscas";

/** Mesmo motivo do título de `/vagas`: o título diz o lugar filtrado. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { uf, cidade } = lugarDaBusca(await searchParams);
  const lugar = cidade ?? UFS.find((u) => u.sigla === uf)?.nome;

  if (lugar) {
    return {
      title: `Profissionais e serviços em ${lugar}`,
      description: `Eletricista, diarista, pintor, encanador e mais em ${lugar}. Contato direto pelo WhatsApp.`,
    };
  }

  return {
    title: "Profissionais e serviços",
    description:
      "Eletricista, diarista, pintor, encanador e mais, com quem está mais perto de você primeiro. Contato direto pelo WhatsApp.",
  };
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => umParametro(params, key);

  const minRating = single("avaliacao");
  const lugar = lugarDaBusca(params);

  // Ordena, não filtra — o profissional mais perto aparece primeiro.
  const perto = await origemDoUsuario();
  const sessao = await sessaoAtual();
  const podeVirarPrestador = Boolean(
    sessao && pode(sessao.papel, "prestador:ativar"),
  );

  // Sem lugar na URL, a busca é do Brasil inteiro, como o chip "Todo o
  // Brasil" promete — ver o comentário longo em `/vagas`.
  const { itens: providers, houveCorte } = await getProviders({
    city: lugar.cidade,
    uf: lugar.uf,
    category: single("categoria"),
    min_rating: minRating ? Number(minRating) : undefined,
    q: single("q"),
    perto,
  });

  // Mesma razão do `/vagas`: só o termo, nunca quem digitou, e depois da
  // resposta.
  if (providers.length === 0) {
    after(() => contarBuscaSemResultado(single("q"), "servicos"));
  }

  // A ordem é dita na tela; ver o comentário longo em `/vagas`.
  const ordenadoPorProximidade = Boolean(perto && !lugar.cidade);
  const temFiltro = Boolean(
    lugar.uf || single("categoria") || minRating || single("q"),
  );

  return (
    <PageShell>
      <PageTitle
        title="Serviços"
        accent="text-servicos"
        description="Profissionais da sua região, com avaliação e CPF conferido."
      />

      <FilterBar
        accent="servicos"
        searchPlaceholder="Buscar eletricista, diarista, pintor..."
        values={{
          uf: lugar.uf,
          cidade: lugar.cidade,
          categoria: single("categoria"),
          avaliacao: minRating,
          q: single("q"),
        }}
        filters={[
          ...filtrosDeLugar(lugar.uf),
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

      {/* O recorte é dito na tela; ver o comentário longo em `/vagas`. */}
      <p className="mb-3 text-xs text-muted">
        {houveCorte
          ? `Mostrando ${providers.length} profissionais`
          : pluralize(
              providers.length,
              "profissional encontrado",
              "profissionais encontrados",
            )}
        {ordenadoPorProximidade && providers.length > 0 && (
          <> · mais perto de você primeiro</>
        )}
        {houveCorte && <> · há mais: use os filtros para estreitar</>}
      </p>

      {providers.length === 0 ? (
        /*
         * Sem filtro nenhum, "tente outro filtro" não ajuda: a vitrine está
         * vazia, não a busca (#302). A frase precisa dizer qual dos dois.
         */
        temFiltro ? (
          <EmptyState
            icon={<SearchX size={22} />}
            title="Nenhum profissional com esses filtros"
            description="Tente outra categoria, outra cidade, ou baixe a exigência de nota."
            action={
              <ButtonLink href="/servicos" variant="outline" size="sm">
                Limpar busca
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon={<SearchX size={22} />}
            title="Ainda não há profissionais na vitrine"
            description="Quem oferece serviço aparece aqui assim que ativa o perfil de prestador."
          />
        )
      ) : (
        <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.profile_id} provider={provider} />
          ))}
        </div>
      )}

      {/*
       * O convite só para quem ainda pode aceitar.
       *
       * Ele mandava para `/cadastro?tipo=prestador_servico` — a tela de
       * criar conta — e aparecia para todo mundo, inclusive para quem já
       * tinha o perfil pronto. É o mesmo bug que a #112 corrigiu no card da
       * home, e este passou batido: convite para fazer o que já está feito
       * faz a pessoa duvidar do que ela mesma fez.
       */}
      {podeVirarPrestador && (
        <div className="mt-8 rounded-[var(--radius-panel)] border border-servicos/25 bg-gradient-to-br from-servicos/8 to-transparent p-5 text-center">
          <p className="font-semibold">Você presta algum desses serviços?</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Criar seu perfil é gratuito. Apareça para quem está procurando na
            sua região.
          </p>
          <ButtonLink
            href="/perfil/virar-prestador"
            variant="servicos"
            size="sm"
            className="mt-4"
          >
            Criar meu perfil
          </ButtonLink>
        </div>
      )}
    </PageShell>
  );
}
