import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EmptyState,
  PageShell,
  PageTitle,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  empresaDoPainel,
  getCompanyApplications,
  getCompanyJobs,
} from "@/lib/data";
import { pluralize, prazoDaVaga, timeAgo, vagaExpirada } from "@/lib/format";
import {
  LIMIAR_MUITO_COMPATIVEL,
  resultadosDasVagas,
} from "@/lib/resultado-da-vaga";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { matchPorCandidatura } from "@/server/candidaturas/match";
import {
  temPainelDeEmpresa,
  visualizacoesPorVaga,
} from "@/server/visualizacoes/servico";
import { AbasDaContratacao } from "./abas";
import type { AreaDeContratacao } from "./area";
import { EncerrarVagaButton } from "./encerrar-vaga-button";
import { ReativarVagaButton } from "./reativar-vaga-button";
import { ResultadoDaVagaLinha } from "./resultado-da-vaga";

/**
 * As vagas da empresa, com o resultado de cada uma (#511).
 *
 * Era a lista do meio do painel. Virou aba porque o painel passou a ser o
 * resumo do dia, e a lista de vagas é onde se encerra, reativa e publica
 * outra parecida — trabalho, e não resumo.
 */
export async function VagasDaContratacao({
  area,
}: {
  area: AreaDeContratacao;
}) {
  const sessao = await sessaoOuEntrar(`${area.base}/vagas`);
  if (!temPainelDeEmpresa(sessao)) notFound();

  const empresaId = empresaDoPainel(sessao.usuarioId);
  const [jobs, applications, porVaga] = await Promise.all([
    getCompanyJobs(empresaId),
    getCompanyApplications(empresaId),
    visualizacoesPorVaga(sessao),
  ]);
  const match = matchPorCandidatura(applications, jobs);
  // O resultado de cada vaga (#492): visualizações, candidaturas e quantas
  // combinam com o que a vaga pede, juntos, no fim da linha dela.
  const resultados = resultadosDasVagas(jobs, applications, match, porVaga);

  return (
    <PageShell>
      <PageTitle
        title="Vagas"
        accent="text-empresas"
        description="Suas vagas, com o resultado de cada uma."
        action={
          <ButtonLink href={`${area.base}/vagas/nova`} variant="empresas">
            <Plus size={17} />
            Publicar nova vaga
          </ButtonLink>
        }
      />
      <AbasDaContratacao area={area} />

      {/* Vagas publicadas */}
      <section>
        <h2 className="text-base font-bold">Vagas publicadas</h2>
        {/*
          O que a visualização é, dito uma vez, antes dos números (#492): ela
          serve para comparar uma vaga com outra, e não para contar pessoas —
          quem recarrega a página conta de novo, porque a Lupa não guarda
          quem viu.
        */}
        <p className="mt-1 mb-3 text-faint text-xs leading-relaxed">
          Visualização serve para comparar uma vaga com outra, não para contar
          pessoas: quem abre de novo conta de novo. Muito compatível é quem
          combina com {LIMIAR_MUITO_COMPATIVEL}% ou mais do que a vaga pede.
        </p>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Você ainda não publicou nenhuma vaga"
            description="Publicar leva menos de dois minutos, e usa uma vaga do seu saldo."
            action={
              <ButtonLink
                href={`${area.base}/vagas/nova`}
                variant="empresas"
                size="sm"
              >
                <Plus size={16} />
                Publicar vaga
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
            {jobs.map((job) => {
              const expirada =
                job.status === "aberta" && vagaExpirada(job.expires_at);
              const resultado = resultados.get(job.id);
              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-panel-2"
                >
                  <Link
                    href={`/vagas/${job.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Duas linhas, e não uma cortada: ao lado há o selo de
                          estado e o botão (#479). */}
                      <p className="line-clamp-2 text-sm font-semibold">
                        {job.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {pluralize(
                          job.applicant_count,
                          "candidato",
                          "candidatos",
                        )}{" "}
                        · {timeAgo(job.created_at)}
                        {job.status === "aberta" &&
                          ` · ${prazoDaVaga(job.expires_at)}`}
                      </p>
                    </div>
                    <Badge
                      tone={
                        expirada
                          ? "warn"
                          : job.status === "aberta"
                            ? "vagas"
                            : "neutral"
                      }
                    >
                      {expirada
                        ? "Expirada"
                        : job.status === "aberta"
                          ? "Ativa"
                          : "Encerrada"}
                    </Badge>
                  </Link>
                  {/*
                    O "Encerrar" devolve o botão e, ao ser tocado, um quadro de
                    confirmação que ocupa a linha inteira: por isso a linha é
                    `flex-wrap` e o botão é filho direto dela (#481).
                  */}
                  {job.status === "aberta" &&
                    (expirada ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <ReativarVagaButton id={job.id} />
                      </div>
                    ) : (
                      <EncerrarVagaButton id={job.id} titulo={job.title} />
                    ))}
                  {resultado && (
                    <div className="basis-full">
                      <ResultadoDaVagaLinha
                        resultado={resultado}
                        finalizada={job.status !== "aberta" || expirada}
                        vagaId={job.id}
                        base={area.base}
                      />
                    </div>
                  )}
                  {job.applicant_count > 0 && (
                    <Link
                      href={`${area.base}/funil?vaga=${job.id}`}
                      className="inline-flex min-h-11 basis-full items-center text-empresas text-xs underline-offset-2 hover:underline"
                    >
                      Ver os candidatos desta vaga
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
