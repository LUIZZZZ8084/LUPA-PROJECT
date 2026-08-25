import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { vagaParaEditar } from "@/server/vagas/servico";
import { EditJobForm } from "./form";

export const metadata: Metadata = {
  title: "Editar vaga",
};

export default async function EditarVagaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();

  // Vaga inexistente e vaga de outra empresa respondem igual: 404, não
  // 403. Um 403 confirmaria que o id existe, informação de graça para
  // quem está sondando.
  const vaga = await vagaParaEditar(sessao, id);
  if (!vaga) notFound();

  return (
    <PageShell width="narrow">
      <BackLink href="/empresa" label="Voltar para Minha Empresa" />
      <PageTitle
        title="Editar vaga"
        accent="text-empresas"
        description="As mudanças valem a partir de agora — quem já se candidatou continua com a candidatura."
      />
      <EditJobForm vaga={vaga} />
    </PageShell>
  );
}
