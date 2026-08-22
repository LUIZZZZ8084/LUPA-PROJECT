import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { linkDoCurriculo } from "@/server/arquivos/perfil";
import { temArmazenamento } from "@/server/arquivos/servico";
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

  /*
   * O currículo mora em bucket privado, então não há URL fixa: o banco
   * guarda o caminho e o link nasce aqui, válido por pouco tempo.
   */
  const linkCurriculo = await linkDoCurriculo(
    perfil.candidato?.curriculoUrl ?? null,
  );

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar ao perfil" />

      <PageTitle
        title="Editar perfil"
        description="O que está aqui é o que as pessoas veem antes de decidir falar com você."
      />

      <FormularioDePerfil
        perfil={perfil}
        linkCurriculo={linkCurriculo}
        temArmazenamento={temArmazenamento}
      />
    </PageShell>
  );
}
