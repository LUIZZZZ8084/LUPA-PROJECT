import type { Metadata } from "next";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { CIDADE_INICIAL } from "@/lib/constants";
import { sessaoAtual } from "@/server/auth/cookies";
import { usuarioDaSessao } from "@/server/auth/servico";
import { NewJobForm } from "./form";

export const metadata: Metadata = {
  title: "Publicar nova vaga",
};

export default async function NovaVagaPage() {
  /*
   * A cidade da empresa é só o valor inicial, não uma trava: quem tem sede
   * em Sinop e contrata em Sorriso precisa poder trocar. O que não pode é
   * fazer a empresa escolher a própria cidade toda vez que publica.
   */
  const sessao = await sessaoAtual();
  const usuario = sessao ? await usuarioDaSessao(sessao.usuarioId) : null;

  return (
    <PageShell width="narrow">
      <BackLink href="/empresa" label="Voltar para Minha Empresa" />
      <PageTitle
        title="Publicar nova vaga"
        accent="text-empresas"
        description="Quanto mais claro o anúncio, menos currículo fora do perfil você recebe."
      />
      <NewJobForm cidadeDaEmpresa={usuario?.cidade ?? CIDADE_INICIAL} />
    </PageShell>
  );
}
