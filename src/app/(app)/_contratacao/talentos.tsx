import { SearchX, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import {
  BackLink,
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { umParametro } from "@/lib/busca";
import { JOB_CATEGORIES } from "@/lib/constants";
import { pluralize, timeAgo } from "@/lib/format";
import { TETO_CANDIDATURAS } from "@/lib/limites-de-lista";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { talentosDaEmpresa } from "@/server/candidaturas/talentos";
import { temPainelDeEmpresa } from "@/server/visualizacoes/servico";
import type { AreaDeContratacao } from "./area";

/**
 * "Quem já se candidatou": todo mundo que se candidatou a alguma vaga desta
 * empresa, sem repetir (#494).
 *
 * Ao abrir outra vaga parecida, a empresa não precisa começar do zero: a
 * lista que ela já formou está aqui, com a vaga e a data da última
 * candidatura de cada pessoa. É a mesma pessoa e o mesmo consentimento da
 * lista de currículos do painel — só reúne o que já era da empresa.
 *
 * Quem decide é a página, como em `/empresa`: 404 para quem não tem painel.
 */
export async function QuemJaSeCandidatou({
  area,
  searchParams,
}: {
  area: AreaDeContratacao;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await sessaoOuEntrar(`${area.base}/talentos`);
  if (!temPainelDeEmpresa(sessao)) notFound();

  const params = await searchParams;
  const habilidade = umParametro(params, "q");
  const areaDesejada = umParametro(params, "area");

  const talentos = await talentosDaEmpresa(sessao, {
    habilidade,
    area: areaDesejada,
  });
  const filtrando = Boolean(habilidade || areaDesejada);

  return (
    <PageShell>
      <BackLink href={area.base} label={`Voltar para ${area.nome}`} />
      <PageTitle
        title="Quem já se candidatou"
        accent="text-empresas"
        description="Todo mundo que já se candidatou a alguma vaga sua, sem repetir. Quem se candidatou a mais de uma aparece uma vez, com a vaga mais recente."
      />

      <FilterBar
        accent="vagas"
        searchPlaceholder="Buscar por habilidade, ex.: colheitadeira"
        values={{ q: habilidade, area: areaDesejada }}
        filters={[
          {
            key: "area",
            placeholder: "Área desejada",
            options: JOB_CATEGORIES.map((c) => ({ value: c, label: c })),
          },
        ]}
      />

      <p className="mb-3 text-muted text-xs">
        {pluralize(talentos.length, "pessoa", "pessoas")} · a candidatura mais
        recente primeiro
      </p>

      {talentos.length === 0 ? (
        <EmptyState
          icon={filtrando ? <SearchX size={22} /> : <Users size={22} />}
          title={
            filtrando
              ? "Ninguém com esses filtros"
              : "Ninguém se candidatou ainda"
          }
          description={
            filtrando
              ? "Tente outra habilidade ou remova a área desejada."
              : "Assim que alguém se candidatar a uma vaga sua, a pessoa passa a aparecer aqui — e continua aparecendo quando você abrir outras vagas."
          }
          action={
            filtrando ? (
              <ButtonLink
                href={`${area.base}/talentos`}
                variant="outline"
                size="sm"
              >
                Limpar busca
              </ButtonLink>
            ) : (
              <ButtonLink
                href={`${area.base}/vagas/nova`}
                variant="empresas"
                size="sm"
              >
                Publicar vaga
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
          {talentos.map((t) => (
            <li key={t.candidatoId}>
              {/*
                A linha abre a ficha da candidatura mais recente: é por ela
                que a empresa tem direito ao currículo e ao contato, e a
                ficha é a mesma da lista do painel.
              */}
              <Link
                href={`${area.base}/candidaturas/${t.ultima.candidaturaId}`}
                className="group flex items-start gap-3 p-4 transition-colors hover:bg-panel-2"
              >
                <Avatar name={t.nome} src={t.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-sm underline-offset-2 group-hover:underline">
                    {t.nome}
                  </p>
                  <p className="truncate text-muted text-xs">
                    {t.areaDesejada ?? "Área não informada"}
                    {t.cidade ? ` · ${t.cidade}` : ""}
                  </p>
                  <p className="mt-0.5 text-muted text-xs">
                    Última candidatura:{" "}
                    <span className="font-semibold text-ink">
                      {t.ultima.vagaTitulo}
                    </span>{" "}
                    · {timeAgo(t.ultima.em)}
                    {t.vagas > 1 && ` · ${pluralize(t.vagas, "vaga", "vagas")}`}
                  </p>

                  {t.casadas.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.casadas.map((h) => (
                        <Badge key={h} tone="vagas">
                          {h}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/*
        A lista nasce das candidaturas mais recentes, com o teto que o painel
        já tem; dizer isso evita a conclusão de que uma pessoa antiga sumiu.
      */}
      <p className="mt-3 text-faint text-xs leading-relaxed">
        Aparecem as candidaturas mais recentes, até {TETO_CANDIDATURAS}. Quem
        exclui a conta sai da lista.
      </p>
    </PageShell>
  );
}
