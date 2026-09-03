import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { temArmazenamento } from "@/server/arquivos/servico";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { usuarioDaSessao } from "@/server/auth/servico";
import { exigeFotoDePerfil } from "@/server/prestadores/servico";
import { AtivarPrestadorForm } from "./form";

export const metadata: Metadata = {
  title: "Oferecer serviço",
};

export default async function VirarPrestadorPage() {
  const sessao = await sessaoAtual();

  if (!sessao) notFound();

  /*
   * Quem já é prestador vai para o próprio perfil, e isso não é gentileza:
   * é o que faz a ativação terminar bem.
   *
   * A action chama `revalidatePath("/", "layout")` — o papel decide o menu
   * inteiro. Isso re-renderiza *esta* rota, que a essa altura já recusa a
   * pessoa. Com `notFound()` aqui, quem acabou de ativar com sucesso via
   * "Não encontramos essa página", e a navegação do cliente perdia a
   * corrida contra a revalidação. Achado pelo e2e, não pela leitura.
   *
   * Redirecionar também não vaza nada: quem é prestador sabe que esta tela
   * existe — acabou de sair dela.
   */
  if (sessao.papel === "prestador_servico") redirect("/perfil");

  /*
   * Empresa (é CNPJ, não CPF) e admin (não age no lugar de ninguém) não
   * ativam. Para esses, 404 e não 403, como no resto da casa: confirmar
   * que a tela existe já é informação para quem sonda.
   */
  if (!pode(sessao.papel, "prestador:ativar")) notFound();

  const usuario = await usuarioDaSessao(sessao.usuarioId);
  if (!usuario) notFound();

  const precisaDeFoto =
    exigeFotoDePerfil(temArmazenamento) && !usuario.avatarUrl;

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar ao perfil" />
      <PageTitle
        title="Oferecer serviço"
        accent="text-servicos"
        description="Seu perfil vira um anúncio: quem procura eletricista, diarista ou pedreiro na sua região passa a te encontrar."
      />

      <AtivarPrestadorForm
        precisaDeFoto={precisaDeFoto}
        bairro={usuario.bairro}
        temCpf={Boolean(usuario.cpf)}
      />
    </PageShell>
  );
}
