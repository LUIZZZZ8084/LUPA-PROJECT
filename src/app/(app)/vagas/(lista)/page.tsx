import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import { FilterBar } from "@/components/filter-bar";
import { JobCard } from "@/components/job-card";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { filtrosDeLugar, lugarDaBusca, umParametro } from "@/lib/busca";
import { UFS } from "@/lib/cidades";
import { CONTRACT_TYPES, JOB_CATEGORIES } from "@/lib/constants";
import { getJobs } from "@/lib/data";
import { pluralize } from "@/lib/format";
import { origemDoUsuario } from "@/server/auth/origem";
import { contarBuscaSemResultado } from "@/server/buscas";

/**
 * O título acompanha o lugar filtrado.
 *
 * Fixo, ele anunciava um lugar para quem abria a busca de outro —
 * inclusive para quem compartilha o link. A página que responde "vagas em
 * Sorriso - MT" precisa se chamar assim. Sem lugar escolhido, a busca é do
 * Brasil inteiro (#301), e o título não promete cidade nenhuma.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { uf, cidade } = lugarDaBusca(await searchParams);
  const lugar = cidade ?? UFS.find((u) => u.sigla === uf)?.nome;

  if (lugar) {
    return {
      title: `Vagas de emprego em ${lugar}`,
      description: `Vagas CLT, estágio e temporárias em ${lugar}, filtradas por categoria e tipo de contrato.`,
    };
  }

  return {
    title: "Vagas de emprego",
    description:
      "Vagas CLT, estágio e temporárias no Brasil inteiro, com o que está mais perto de você primeiro. Filtre por estado, cidade, categoria e tipo de contrato.",
  };
}

export default async function VagasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const single = (key: string) => umParametro(params, key);

  /*
   * Sem lugar na URL, a busca é do Brasil inteiro — não de uma cidade
   * padrão.
   *
   * Um `?? "Sinop"` já viveu aqui, de quando Sinop era a única cidade, e
   * escondia toda vaga publicada fora dela: a empresa via a vaga no painel
   * e nos destaques da home e não via na busca (#76). O chip do filtro
   * anuncia "Todo o Brasil" enquanto nada está escolhido, e `undefined` é o
   * que faz a tela entregar o que ela promete.
   */
  const lugar = lugarDaBusca(params);
  /*
   * Ordena, não filtra: o mais perto de quem está olhando vem primeiro, e
   * nada sai da lista por estar longe. Sem isso, quem é de Sinop abre a
   * busca do país inteiro e a primeira coisa que vê pode ser uma vaga no
   * Rio Grande do Sul.
   */
  const perto = await origemDoUsuario();

  const filters = {
    city: lugar.cidade,
    uf: lugar.uf,
    category: single("categoria"),
    contract_type: single("tipo"),
    q: single("q"),
    perto,
  };

  const { itens: jobs, houveCorte } = await getJobs(filters);

  /*
   * Busca que não achou nada vira estatística, por `after()`.
   *
   * Depois da resposta: quem buscou quer ver a tela, mesmo que a tela diga
   * "nada encontrado". E só o termo — nunca quem digitou. Histórico de
   * busca de quem procura emprego é a mesma classe de informação que o
   * currículo.
   *
   * Para que serve: hoje não existe registro do que as pessoas procuram e
   * não encontram, e sem isso escolher entre ampliar a tabela de sinônimos
   * e partir para busca semântica é palpite.
   */
  if (jobs.length === 0) {
    after(() => contarBuscaSemResultado(filters.q, "vagas"));
  }

  /*
   * A ordenação é dita na tela, não só sentida.
   *
   * Ordem que muda o resultado sem aparecer em lugar nenhum é a mesma
   * armadilha da #76, onde um padrão invisível escondia vaga e a empresa
   * concluía que não tinha publicado. Aqui não esconde nada, mas quem vê
   * uma vaga de outra cidade no meio da lista merece saber por que a ordem
   * é aquela — e que dá para trocar pelo filtro de cidade.
   *
   * Só aparece sem cidade escolhida: com o filtro em Sorriso, "mais perto
   * de você" descreveria uma ordenação que já não decide quase nada.
   */
  const ordenadoPorProximidade = Boolean(perto && !filters.city);

  return (
    <PageShell>
      <PageTitle
        title="Vagas"
        accent="text-vagas"
        description="Vagas de emprego no Brasil inteiro, direto de quem está contratando."
      />

      <FilterBar
        accent="vagas"
        searchPlaceholder="Buscar vaga, cargo ou empresa..."
        values={{
          uf: lugar.uf,
          cidade: lugar.cidade,
          categoria: single("categoria"),
          tipo: single("tipo"),
          q: single("q"),
        }}
        filters={[
          ...filtrosDeLugar(lugar.uf),
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

      {/*
        O recorte é dito na tela, como a ordenação já era.

        A busca traz no máximo `TETO_BUSCA` linhas — sem isso, com a base
        crescida, toda abertura desta página puxaria a tabela inteira. Mas
        cortar em silêncio seria a armadilha da #76 de novo: lá um padrão
        invisível escondia vaga e a empresa concluía que não tinha
        publicado. Quem chegou ao teto precisa saber que existe mais, e
        que o filtro é o caminho.
      */}
      <p className="mb-3 text-xs text-muted">
        {houveCorte
          ? `Mostrando ${jobs.length} vagas`
          : pluralize(jobs.length, "vaga encontrada", "vagas encontradas")}
        {ordenadoPorProximidade && jobs.length > 0 && (
          <> · mais perto de você primeiro</>
        )}
        {houveCorte && <> · há mais: use os filtros para estreitar</>}
      </p>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<SearchX size={22} />}
          title="Nenhuma vaga com esses filtros"
          description="Tente remover um filtro, buscar por outro cargo, ou abrir para toda a região."
          action={
            <ButtonLink href="/vagas" variant="outline" size="sm">
              Limpar busca
            </ButtonLink>
          }
        />
      ) : (
        <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} perto={perto} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
