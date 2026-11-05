import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { ROTULO_PCD, WORK_MODE_LABELS } from "@/lib/constants";
import {
  empresaDoPainel,
  getCompanyApplications,
  getJobById,
} from "@/lib/data";
import { vagaExpirada } from "@/lib/format";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import type { AreaDeContratacao } from "./area";
import { EditarVagaForm, type VagaParaEditar } from "./editar-vaga-form";

/**
 * A tela de editar a vaga publicada (#544), nas duas áreas de contratação.
 *
 * O portão é o da matriz (`vaga:editar_propria`) mais o dono — vaga que não
 * existe e vaga de outra empresa respondem o mesmo 404, para quem sonda ids
 * não saber qual dos dois. Vaga fora do ar também: não há o que corrigir num
 * anúncio que ninguém vê, e o caminho é publicar outra parecida.
 */
export async function EditarVaga({
  params,
  area,
}: {
  params: Promise<{ id: string }>;
  area: AreaDeContratacao;
}) {
  const { id } = await params;
  const sessao = await sessaoOuEntrar(`${area.base}/vagas/${id}/editar`);
  if (!pode(sessao.papel, "vaga:editar_propria")) notFound();

  const empresaId = empresaDoPainel(sessao.usuarioId);
  const job = await getJobById(id);
  if (!job || job.company_id !== empresaId) notFound();
  if (job.status !== "aberta" || vagaExpirada(job.expires_at)) notFound();

  const candidaturas = (await getCompanyApplications(empresaId)).filter(
    (c) => c.job_id === job.id,
  );

  const vaga: VagaParaEditar = {
    id: job.id,
    travados: [
      { rotulo: "Cargo", valor: job.title },
      { rotulo: "Cidade", valor: job.city },
      ...(job.category ? [{ rotulo: "Área", valor: job.category }] : []),
      ...(job.contract_type
        ? [{ rotulo: "Contrato", valor: job.contract_type }]
        : []),
      ...(job.work_mode
        ? [{ rotulo: "Modalidade", valor: WORK_MODE_LABELS[job.work_mode] }]
        : []),
      { rotulo: "PCD", valor: job.for_pcd ? ROTULO_PCD : "Não" },
      ...((job.screening_questions ?? []).length > 0
        ? [
            {
              rotulo: "Perguntas",
              valor: String((job.screening_questions ?? []).length),
            },
          ]
        : []),
    ],
    descricao: job.description,
    bairro: job.neighborhood ?? "",
    endereco: job.address ?? "",
    habilidades: job.skills.join(", "),
    salarioMin: job.salary_min ? String(job.salary_min) : "",
    salarioMax: job.salary_max ? String(job.salary_max) : "",
    temCandidaturas: candidaturas.length > 0,
  };

  return (
    <PageShell width="formulario">
      <BackLink href={`${area.base}/vagas`} label="Voltar para as vagas" />
      <PageTitle
        title="Editar vaga"
        accent="text-empresas"
        description={`${job.title} · ${job.city}. O prazo de 30 dias e as candidaturas continuam como estão.`}
      />
      <EditarVagaForm vaga={vaga} />
    </PageShell>
  );
}
