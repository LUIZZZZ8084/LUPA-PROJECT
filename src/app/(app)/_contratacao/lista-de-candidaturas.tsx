import { ListFilter, SearchX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { umParametro } from "@/lib/busca";
import { APPLICATION_LABELS, APPLICATION_TONE } from "@/lib/constants";
import {
  empresaDoPainel,
  getCompanyApplications,
  getCompanyJobs,
} from "@/lib/data";
import { pluralize, timeAgo } from "@/lib/format";
import { ESTAGIOS, ehEstagio } from "@/lib/funil-de-candidaturas";
import { TETO_CANDIDATURAS } from "@/lib/limites-de-lista";
import { ehPeriodo, filtrarCandidaturas } from "@/lib/lista-de-candidaturas";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { temPainelDeEmpresa } from "@/server/visualizacoes/servico";
import { AbasDaContratacao } from "./abas";
import type { AreaDeContratacao } from "./area";
import { VistaDosCandidatos } from "./vista-dos-candidatos";

/**
 * Os candidatos em lista (#620): uma linha por candidatura, filtrada por
 * vaga, etapa, período e nome.
 *
 * O quadro responde "onde está cada um?"; a lista responde "quem chegou na
 * semana para a vaga X?" e "cadê a Maria?". As duas vistas são da mesma aba,
 * com o mesmo portão, e cada linha abre a ficha.
 *
 * **Os filtros são aplicados no servidor**, sobre as candidaturas desta
 * empresa, que já vêm lidas pela empresa da sessão. Vaga de fora da empresa
 * na URL não filtra nada: é ignorada, como no quadro.
 */
export async function ListaDeCandidaturas({
  area,
  searchParams,
}: {
  area: AreaDeContratacao;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await sessaoOuEntrar(`${area.base}/candidaturas`);
  if (!temPainelDeEmpresa(sessao)) notFound();

  const params = await searchParams;
  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [vagas, candidaturas] = await Promise.all([
    getCompanyJobs(empresaId),
    getCompanyApplications(empresaId),
  ]);

  const nome = umParametro(params, "q")?.trim() ?? "";
  const pedidaVaga = umParametro(params, "vaga");
  const vaga =
    pedidaVaga && vagas.some((v) => v.id === pedidaVaga)
      ? pedidaVaga
      : undefined;
  const pedidoEstagio = umParametro(params, "estagio");
  const estagio = ehEstagio(pedidoEstagio) ? pedidoEstagio : undefined;
  const pedidoPeriodo = umParametro(params, "periodo");
  const periodo = ehPeriodo(pedidoPeriodo) ? pedidoPeriodo : undefined;

  const lista = filtrarCandidaturas(candidaturas, {
    nome,
    vaga,
    estagio,
    periodo,
  });
  const filtrando = Boolean(nome || vaga || estagio || periodo);

  return (
    <PageShell>
      <PageTitle
        title="Candidatos"
        accent="text-empresas"
        description="Cada candidatura em uma linha. Filtre por vaga, etapa, período ou nome, e abra a ficha."
      />
      <AbasDaContratacao area={area} />
      <VistaDosCandidatos area={area} atual="lista" />

      <FilterBar
        searchPlaceholder="Buscar pelo nome…"
        values={{ q: nome || undefined, vaga, estagio, periodo }}
        filters={[
          {
            key: "vaga",
            placeholder: "Todas as vagas",
            options: vagas.map((v) => ({ value: v.id, label: v.title })),
          },
          {
            key: "estagio",
            placeholder: "Todas as etapas",
            options: ESTAGIOS.map((e) => ({
              value: e,
              label: APPLICATION_LABELS[e],
            })),
          },
          {
            key: "periodo",
            placeholder: "Qualquer data",
            options: [
              { value: "7", label: "Últimos 7 dias" },
              { value: "30", label: "Últimos 30 dias" },
            ],
          },
        ]}
      />

      <p className="mb-3 text-muted text-xs">
        {pluralize(lista.length, "candidatura", "candidaturas")} · a mais
        recente primeiro
      </p>

      {lista.length === 0 ? (
        <EmptyState
          icon={filtrando ? <SearchX size={22} /> : <ListFilter size={22} />}
          title={
            filtrando
              ? "Ninguém com esses filtros"
              : "Nenhuma candidatura ainda"
          }
          description={
            filtrando
              ? "Tente outro nome, ou tire um dos filtros."
              : "Assim que alguém se candidatar às suas vagas, a candidatura aparece aqui."
          }
          action={
            filtrando ? (
              <ButtonLink
                href={`${area.base}/candidaturas`}
                variant="outline"
                size="sm"
              >
                Limpar filtros
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
          {lista.map((c) => (
            <li key={c.id}>
              <Link
                href={`${area.base}/candidaturas/${c.id}`}
                className="group flex min-h-11 items-center gap-3 p-4 transition-colors hover:bg-panel-2"
              >
                <Avatar
                  name={c.candidate.full_name}
                  src={c.candidate.avatar_url}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-sm underline-offset-2 group-hover:underline">
                    {c.candidate.full_name}
                  </span>
                  <span className="block truncate text-muted text-xs">
                    {c.job_title} · {timeAgo(c.created_at)}
                  </span>
                </span>
                <Badge tone={APPLICATION_TONE[c.status]}>
                  {APPLICATION_LABELS[c.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {candidaturas.length >= TETO_CANDIDATURAS && (
        <p className="mt-3 text-faint text-xs">
          Mostrando as {TETO_CANDIDATURAS} candidaturas mais recentes.
        </p>
      )}
    </PageShell>
  );
}
