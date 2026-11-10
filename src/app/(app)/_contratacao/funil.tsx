import { Columns3 } from "lucide-react";
import { notFound } from "next/navigation";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { umParametro } from "@/lib/busca";
import {
  empresaDoPainel,
  getCompany,
  getCompanyApplications,
  getCompanyJobs,
} from "@/lib/data";
import { ehEstagio } from "@/lib/funil-de-candidaturas";
import { TETO_CANDIDATURAS } from "@/lib/limites-de-lista";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { temPainelDeEmpresa } from "@/server/visualizacoes/servico";
import { AbasDaContratacao } from "./abas";
import type { AreaDeContratacao } from "./area";
import { montarCardsDoFunil } from "./cards-do-funil";
import { QuadroDoFunil } from "./quadro-do-funil";

/**
 * O funil de candidatos (#511): cada candidatura no estágio em que está.
 *
 * É a aba que faz da área de contratação um mini CRM — o lugar onde quem
 * recruta todo mês vê de relance quem é novo, quem está em entrevista e
 * quem foi selecionado, e move cada um com um gesto.
 *
 * As candidaturas são as mesmas da lista que morava no painel, e o alcance é
 * o mesmo: só as da empresa da sessão. O card leva só o que a tela mostra —
 * nome, vaga, estágio, compatibilidade, triagem e o link do WhatsApp —, e
 * não o currículo: ele continua chegando pela ficha.
 */
export async function FunilDaContratacao({
  area,
  searchParams,
}: {
  area: AreaDeContratacao;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await sessaoOuEntrar(`${area.base}/funil`);
  if (!temPainelDeEmpresa(sessao)) notFound();

  const params = await searchParams;
  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [empresa, vagas, candidaturas] = await Promise.all([
    getCompany(empresaId),
    getCompanyJobs(empresaId),
    getCompanyApplications(empresaId),
  ]);

  // O id vem da URL: só vale se for de uma vaga desta empresa.
  const pedida = umParametro(params, "vaga");
  const vagaEscolhida =
    pedida && vagas.some((v) => v.id === pedida) ? pedida : null;
  const pedido = umParametro(params, "estagio");
  const estagioInicial = ehEstagio(pedido) ? pedido : "enviada";

  const cards = await montarCardsDoFunil({
    candidaturas: candidaturas.filter(
      (c) => !vagaEscolhida || c.job_id === vagaEscolhida,
    ),
    todas: candidaturas,
    vagas,
    nomeDaEmpresa: empresa?.company_name ?? "nossa empresa",
  });

  return (
    <PageShell width="wide">
      <PageTitle
        title="Candidatos"
        accent="text-empresas"
        description="Cada candidatura no estágio em que está. Mova quem avançou, e abra a ficha para ver o currículo."
      />
      <AbasDaContratacao area={area} />

      {candidaturas.length === 0 ? (
        <EmptyState
          icon={<Columns3 size={22} />}
          title="Nenhuma candidatura ainda"
          description="Assim que alguém se candidatar às suas vagas, a pessoa aparece aqui, na coluna das novas."
        />
      ) : (
        <>
          <QuadroDoFunil
            cards={cards}
            base={area.base}
            vagas={vagas.map((v) => ({ id: v.id, titulo: v.title }))}
            vagaEscolhida={vagaEscolhida}
            estagioInicial={estagioInicial}
          />
          {candidaturas.length >= TETO_CANDIDATURAS && (
            <p className="mt-3 text-faint text-xs">
              Mostrando as {TETO_CANDIDATURAS} candidaturas mais recentes.
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
