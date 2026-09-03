import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { CIDADE_INICIAL } from "@/lib/constants";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
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

  /*
   * Mesmo portão do painel, pela mesma razão: a página lia a sessão só
   * para preencher a cidade e nunca perguntava se aquele papel publica
   * vaga. Quem não pode chegava ao formulário inteiro e só descobria no
   * envio, quando a action recusa — formulário preenchido e recusado no
   * fim é a pior forma de dizer "isto não é para você".
   *
   * `vaga:publicar` e não a capacidade do painel: o admin enxerga, e de
   * propósito não publica no lugar de ninguém.
   */
  if (!sessao || !pode(sessao.papel, "vaga:publicar")) notFound();

  const usuario = await usuarioDaSessao(sessao.usuarioId);

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
