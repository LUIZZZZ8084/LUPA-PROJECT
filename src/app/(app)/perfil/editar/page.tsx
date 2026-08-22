import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { perfilParaEditar } from "@/server/perfil/servico";
import { FormularioDePerfil } from "./form";

export const metadata: Metadata = {
  title: "Editar perfil",
};

export default async function EditarPerfilPage() {
  const sessao = await sessaoAtual();

  /*
   * O muro de login já barra quem não tem sessão, mas a página não depende
   * disso: guarda que existe num lugar só é guarda que some quando aquele
   * lugar muda.
   */
  if (!sessao) notFound();

  const perfil = await perfilParaEditar(sessao.usuarioId, sessao.papel);

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar ao perfil" />

      <PageTitle
        title="Editar perfil"
        description="O que está aqui é o que as pessoas veem antes de decidir falar com você."
      />

      <FormularioDePerfil perfil={perfil} />
    </PageShell>
  );
}
