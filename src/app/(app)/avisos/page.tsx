import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvisosDeVaga } from "@/components/avisos-de-vaga";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { sessaoAtual } from "@/server/auth/cookies";
import { usuarioDaSessao } from "@/server/auth/servico";
import { pushConfigurado } from "@/server/notificacoes/push";
import { preferenciaAtual } from "@/server/notificacoes/servico";
import { desligarAvisosDeVaga, inscrever, salvarAvisos } from "./actions";

export const metadata: Metadata = {
  title: "Avisos de vaga",
};

/**
 * Os avisos de vaga nova, em tela própria (#288).
 *
 * Moravam no fim de "Editar perfil", depois de nome, telefone, anúncio e
 * CNPJ — e quem procura emprego não abre "Editar perfil" para isso. O
 * sininho do cabeçalho traz até aqui em um toque. Pedido do Luiz em
 * 24/09/2026, no dia em que as chaves VAPID passaram a existir em
 * produção e o recurso deixou de ser só uma tela dizendo "indisponível".
 *
 * A tela abre para qualquer conta com sessão, como o serviço já permitia;
 * quem decide mostrar o sininho é o cabeçalho, pela capacidade de se
 * candidatar. Uma conta que chegue aqui por link não cai num 404.
 */
export default async function AvisosPage() {
  const sessao = await sessaoAtual();
  // O muro de login já barra quem não tem sessão; a página não depende disso.
  if (!sessao) notFound();

  const [usuario, preferencia] = await Promise.all([
    usuarioDaSessao(sessao.usuarioId),
    preferenciaAtual(sessao),
  ]);
  if (!usuario) notFound();

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Avisos de vaga"
        description="Seu celular avisa quando aparecer vaga nova na cidade e na área que você escolher."
      />

      <AvisosDeVaga
        preferencia={preferencia}
        cidadePadrao={usuario.cidade}
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
