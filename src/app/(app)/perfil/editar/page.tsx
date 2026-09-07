import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvisosDeVaga } from "@/components/avisos-de-vaga";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { linkDoCurriculo } from "@/server/arquivos/perfil";
import { temArmazenamento } from "@/server/arquivos/servico";
import { sessaoAtual } from "@/server/auth/cookies";
import { pushConfigurado } from "@/server/notificacoes/push";
import { preferenciaAtual } from "@/server/notificacoes/servico";
import { perfilParaEditar } from "@/server/perfil/servico";
import {
  desligarAvisosDeVaga,
  inscrever,
  salvarAvisos,
} from "./avisos-actions";
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

  const preferencia = await preferenciaAtual(sessao);

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

      {/*
       * Aviso de vaga nova (#48). Fica aqui, e não em rota própria, pela
       * mesma razão que o resto: um assunto por formulário, cada um com o
       * próprio botão — e uma tela a menos entre a pessoa e a escolha.
       */}
      <AvisosDeVaga
        preferencia={preferencia}
        cidadePadrao={perfil.usuario.cidade}
        pushDisponivel={pushConfigurado}
        chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        salvar={async (dados) => {
          "use server";
          return { ok: (await salvarAvisos(dados)).ok };
        }}
        desligar={async () => {
          "use server";
          return { ok: (await desligarAvisosDeVaga(new FormData())).ok };
        }}
        inscrever={async (dados) => {
          "use server";
          return { ok: (await inscrever(dados)).ok };
        }}
      />
    </PageShell>
  );
}
