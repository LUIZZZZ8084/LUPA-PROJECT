import type { Metadata } from "next";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { NewJobForm } from "./form";

export const metadata: Metadata = {
  title: "Publicar nova vaga",
};

export default function NovaVagaPage() {
  return (
    <PageShell width="narrow">
      <BackLink href="/empresa" label="Voltar para Minha Empresa" />
      <PageTitle
        title="Publicar nova vaga"
        accent="text-empresas"
        description="Quanto mais claro o anúncio, menos currículo fora do perfil você recebe."
      />
      <NewJobForm />
    </PageShell>
  );
}
