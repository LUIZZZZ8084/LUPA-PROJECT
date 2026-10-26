import { SearchX, UserSearch } from "lucide-react";
import type { Metadata } from "next";
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
import { pluralize } from "@/lib/format";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import {
  acessoABuscaDeCandidatos,
  candidatosDisponiveis,
} from "@/server/candidatos/servico";
import { ORCAMENTO_DE_PERFIS_DE_CANDIDATO } from "@/server/limites";

export const metadata: Metadata = {
  title: "Candidatos disponíveis",
  description: "Quem pediu para ser encontrado por empresas.",
};

export default async function CandidatosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await sessaoOuEntrar("/candidatos");

  /*
   * 404 e não 403, como no resto da casa: um 403 confirma que a área
   * existe para quem está sondando. Aqui o que existe é uma lista de
   * pessoas procurando emprego.
   */
  if (!pode(sessao.papel, "candidato:buscar_disponiveis")) {
    notFound();
  }

  /*
   * A busca é de empresa conferida (#433). Quem tem a capacidade mas não
   * conferiu o CNPJ — ou se cadastrou por CPF — lê o que falta, em vez de
   * um 404: a capacidade é dela, e o link no painel é o mesmo.
   */
  if ((await acessoABuscaDeCandidatos(sessao)) === "falta_cnpj_conferido") {
    return (
      <PageShell>
        <PageTitle
          title="Candidatos"
          accent="text-empresas"
          description="Quem pediu para ser encontrado por empresas."
        />
        <EmptyState
          icon={<UserSearch size={22} />}
          title="A busca é para empresa com CNPJ conferido"
          description="Quem liga a opção de ser encontrado escolhe aparecer para empresas, e o telefone dessas pessoas aparece aqui. Por isso a busca abre depois que o CNPJ é conferido na Receita, pelo botão no seu perfil. Conta cadastrada com CPF recebe candidaturas às vagas que publica, mas não busca quem não se candidatou."
          action={
            <ButtonLink href="/perfil" variant="empresas" size="sm">
              Ir para o perfil
            </ButtonLink>
          }
        />
      </PageShell>
    );
  }

  const params = await searchParams;
  const single = (key: string) => umParametro(params, key);

  const habilidade = single("q");
  const area = single("area");

  const candidatos = await candidatosDisponiveis(sessao, { habilidade, area });

  return (
    <PageShell>
      <PageTitle
        title="Candidatos"
        accent="text-empresas"
        description="Quem pediu para ser encontrado por empresas. Currículo não aparece aqui — ele vem junto com a candidatura."
      />

      <FilterBar
        accent="vagas"
        searchPlaceholder="Buscar por habilidade, ex.: colheitadeira"
        values={{ q: habilidade, area }}
        filters={[
          {
            key: "area",
            placeholder: "Área desejada",
            options: JOB_CATEGORIES.map((c) => ({ value: c, label: c })),
          },
        ]}
      />

      <p className="mb-3 text-xs text-muted">
        {pluralize(
          candidatos.length,
          "pessoa disponível",
          "pessoas disponíveis",
        )}
        {candidatos.length > 0 && <> · mais perto de você primeiro</>}
        {candidatos.length > 0 && (
          <>
            {" "}
            · até {ORCAMENTO_DE_PERFIS_DE_CANDIDATO.chamadas} perfis abertos por
            dia
          </>
        )}
      </p>

      {candidatos.length === 0 ? (
        /*
         * Dois vazios diferentes, e a diferença importa: com filtro, o
         * conselho é afrouxar a busca; sem filtro, a lista está vazia
         * porque a opção nasce desligada — e dizer isso evita a conclusão
         * de que a plataforma não tem gente.
         */
        <EmptyState
          icon={
            habilidade || area ? (
              <SearchX size={22} />
            ) : (
              <UserSearch size={22} />
            )
          }
          title={
            habilidade || area
              ? "Ninguém disponível com esses filtros"
              : "Ninguém pediu para ser encontrado ainda"
          }
          description={
            habilidade || area
              ? "Tente outra habilidade ou remova a área desejada."
              : "Aparecer aqui é escolha de cada candidato, e vem desligada. Quem se candidatar às suas vagas continua chegando no painel, como sempre."
          }
          action={
            habilidade || area ? (
              <ButtonLink href="/candidatos" variant="outline" size="sm">
                Limpar busca
              </ButtonLink>
            ) : (
              <ButtonLink href="/empresa" variant="empresas" size="sm">
                Ir para o painel
              </ButtonLink>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
          {candidatos.map((c) => (
            <li key={c.id}>
              <Link
                href={`/candidatos/${c.id}`}
                className="group flex items-center gap-3 p-4 transition-colors hover:bg-panel-2"
              >
                <Avatar name={c.full_name} src={c.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold underline-offset-2 group-hover:underline">
                    {c.full_name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {c.desired_area ?? "Área não informada"}
                    {` · ${c.city}`}
                  </p>

                  {/*
                    Só as que casaram com o filtro. Despejar as vinte
                    habilidades de cada pessoa faria a lista virar parede
                    de texto e esconderia justamente o que se procurou.
                  */}
                  {c.casadas.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.casadas.map((h) => (
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
    </PageShell>
  );
}
