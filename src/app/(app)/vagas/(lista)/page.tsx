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
import { cidadeDaBusca, umParametro } from "@/lib/busca";
import {
  CIDADES,
  CONTRACT_TYPES,
  ESTADO,
  JOB_CATEGORIES,
} from "@/lib/constants";
import { getJobs } from "@/lib/data";
import { pluralize } from "@/lib/format";
import { origemDoUsuario } from "@/server/auth/origem";
import { contarBuscaSemResultado } from "@/server/buscas";

/**
 * O título acompanha a cidade filtrada.
 *
 * Fixo em "Sinop", ele anunciava Sinop para quem abria
 * `/vagas?cidade=Sorriso` — inclusive para o buscador e para quem
 * compartilha o link. A busca por cidade é o argumento do produto; a
 * página que responde "vagas em Sorriso" precisa se chamar assim.
 *
 * Sem cidade escolhida o título fala do estado, e Sinop fica na descrição,
 * que é onde o esforço de divulgação está.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const cidade = cidadeDaBusca(await searchParams);

  if (cidade) {
    return {
      title: `Vagas de emprego em ${cidade}`,
      description: `Vagas CLT, estágio e temporárias em ${cidade}-${ESTADO}, filtradas por categoria, bairro e tipo de contrato.`,
    };
  }

  return {
    title: "Vagas de emprego em Mato Grosso",
    description:
      "Vagas CLT, estágio e temporárias nos 142 municípios de Mato Grosso, começando por Sinop. Filtre por cidade, categoria e tipo de contrato.",
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
  /*
   * Ordena, não filtra: o mais perto de quem está olhando vem primeiro, e
   * nada sai da lista por estar longe. Sem isso, quem é de Sinop abre a
   * busca do estado inteiro e a primeira coisa que vê pode ser Cuiabá, a
   * 500km — o oposto do que "hiperlocal" promete.
   */
  const perto = await origemDoUsuario();

  const filters = {
    city: single("cidade"),
    category: single("categoria"),
    contract_type: single("tipo"),
    q: single("q"),
    perto,
  };

  const jobs = await getJobs(filters);

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
        description="Emprego formal em todo o Mato Grosso, direto de quem está contratando."
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
        {ordenadoPorProximidade && jobs.length > 0 && (
          <> · mais perto de você primeiro</>
        )}
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
