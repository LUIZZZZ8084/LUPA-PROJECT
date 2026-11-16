import { BookmarkCheck, SearchX, Users } from "lucide-react";
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
import { JOB_CATEGORIES } from "@/lib/constants";
import { empresaDoPainel, getCompany, getCompanyJobs } from "@/lib/data";
import { pluralize, timeAgo, vagaExpirada } from "@/lib/format";
import { TETO_CANDIDATURAS } from "@/lib/limites-de-lista";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import {
  etiquetasEmUso,
  talentosDaEmpresa,
} from "@/server/candidaturas/talentos";
import { talentosSalvosDa } from "@/server/talentos/servico";
import { temPainelDeEmpresa } from "@/server/visualizacoes/servico";
import { AbasDaContratacao } from "./abas";
import type { AreaDeContratacao } from "./area";
import { ConvidarParaVaga } from "./convidar-para-vaga";

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
  const etiqueta = umParametro(params, "etiqueta");
  const soGuardados = umParametro(params, "guardados") === "sim";

  const [talentos, todos] = await Promise.all([
    talentosDaEmpresa(sessao, { habilidade, area: areaDesejada, etiqueta }),
    // As opções do filtro de etiqueta vêm de todo mundo, e não só de quem
    // passou nos outros filtros: senão a opção escolhida sumiria da lista.
    talentosDaEmpresa(sessao),
  ]);
  const etiquetas = etiquetasEmUso(todos);

  /*
   * Quem a empresa guardou na ficha (#618), e as vagas no ar para o convite
   * (#620). A lista continua sendo de todo mundo que já se candidatou; o
   * filtro "Só os guardados" recorta, e o selo marca.
   */
  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [guardados, vagasDaEmpresa, empresa] = await Promise.all([
    talentosSalvosDa(sessao),
    getCompanyJobs(empresaId),
    getCompany(empresaId),
  ]);
  const vagasAbertas = vagasDaEmpresa
    .filter(
      (v) =>
        v.status === "aberta" && !vagaExpirada(v.expires_at) && !v.removed_at,
    )
    .map((v) => ({ id: v.id, titulo: v.title, cidade: v.city }));
  const nomeDaEmpresa = empresa?.company_name ?? "nossa empresa";
  const lista = soGuardados
    ? talentos.filter((t) => guardados.has(t.candidatoId))
    : talentos;

  const filtrando = Boolean(
    habilidade || areaDesejada || etiqueta || soGuardados,
  );

  return (
    <PageShell>
      <PageTitle
        title="Talentos"
        accent="text-empresas"
        description="Todo mundo que já se candidatou a alguma vaga sua, uma vez cada. Guarde quem você quer chamar de novo, e convide para uma vaga nova."
      />
      <AbasDaContratacao area={area} />

      <FilterBar
        accent="vagas"
        searchPlaceholder="Buscar por habilidade, ex.: colheitadeira"
        values={{
          q: habilidade,
          area: areaDesejada,
          etiqueta,
          guardados: soGuardados ? "sim" : undefined,
        }}
        filters={[
          // Os guardados na ficha (#618).
          {
            key: "guardados",
            placeholder: "Todos",
            options: [{ value: "sim", label: "Só os guardados" }],
          },
          {
            key: "area",
            placeholder: "Área desejada",
            options: JOB_CATEGORIES.map((c) => ({ value: c, label: c })),
          },
          // Só aparece quando a empresa já etiquetou alguém (#545).
          ...(etiquetas.length > 0
            ? [
                {
                  key: "etiqueta",
                  placeholder: "Etiqueta",
                  options: etiquetas.map((e) => ({ value: e, label: e })),
                },
              ]
            : []),
        ]}
      />

      <p className="mb-3 text-muted text-xs">
        {pluralize(lista.length, "pessoa", "pessoas")} · a candidatura mais
        recente primeiro
      </p>

      {lista.length === 0 ? (
        <EmptyState
          icon={filtrando ? <SearchX size={22} /> : <Users size={22} />}
          title={
            soGuardados && !habilidade && !areaDesejada && !etiqueta
              ? "Ninguém guardado ainda"
              : filtrando
                ? "Ninguém com esses filtros"
                : "Ninguém se candidatou ainda"
          }
          description={
            soGuardados && !habilidade && !areaDesejada && !etiqueta
              ? 'Abra a ficha de quem se candidatou e toque em "Guardar nos talentos". A pessoa aparece aqui para você chamar numa próxima vaga.'
              : filtrando
                ? "Tente outra habilidade, ou remova a área e a etiqueta."
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
        /* Cartões em duas ou três colunas no computador; ver as vagas. */
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel grid-cols-1 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent xl:grid-cols-3">
          {lista.map((t) => (
            <li
              key={t.candidatoId}
              className="lg:overflow-hidden lg:rounded-[var(--radius-card)] lg:border lg:border-line lg:bg-panel"
            >
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
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold text-sm underline-offset-2 group-hover:underline">
                      {t.nome}
                    </span>
                    {guardados.has(t.candidatoId) && (
                      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-empresas/15 px-2 py-0.5 font-medium text-empresas text-xs">
                        <BookmarkCheck size={12} aria-hidden />
                        Guardado
                      </span>
                    )}
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

                  {t.etiquetas.length > 0 && (
                    <ul
                      className="mt-1.5 flex flex-wrap gap-1"
                      aria-label="Etiquetas"
                    >
                      {t.etiquetas.map((e) => (
                        <li
                          key={e}
                          className="rounded-full bg-panel-2 px-2 py-0.5 text-muted text-xs"
                        >
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}

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
              {/*
                Convidar para uma vaga nova (#620): fora do link da linha,
                porque é outra ação. Só com telefone e com vaga no ar.
              */}
              {t.telefone && vagasAbertas.length > 0 && (
                <ConvidarParaVaga
                  nome={t.nome}
                  telefone={t.telefone}
                  empresa={nomeDaEmpresa}
                  vagas={vagasAbertas}
                />
              )}
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
