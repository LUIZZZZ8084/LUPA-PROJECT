import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { temArmazenamento } from "@/server/arquivos/servico";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { listarPublicacoes, resumo } from "@/server/publicacoes/servico";
import { FeedDoPrestador } from "./feed";

export const metadata: Metadata = {
  title: "Meus trabalhos",
};

/**
 * O feed do prestador.
 *
 * O backend disto existia inteiro — serviço, repositório, actions, tabela
 * e trigger de limite — e nenhuma tela o consumia. O atalho do perfil
 * ainda apontava para `/servicos`, a busca pública, prometendo "edite
 * categoria, preço e publicações": a pessoa clicava para editar o próprio
 * anúncio e caía na vitrine de todo mundo.
 */
export default async function PublicacoesPage() {
  const sessao = await sessaoAtual();

  // Quem não publica não tem feed. 404, como no resto da casa.
  if (!sessao || !pode(sessao.papel, "publicacao:criar")) notFound();

  const [publicacoes, contagem] = await Promise.all([
    listarPublicacoes(sessao.usuarioId),
    resumo(sessao.usuarioId),
  ]);

  return (
    <PageShell width="narrow">
      <BackLink href="/perfil" label="Voltar ao perfil" />
      <PageTitle
        title="Meus trabalhos"
        accent="text-servicos"
        description="Cada foto com uma descrição do serviço. É isto que quem procura um profissional olha antes de chamar."
      />

      <FeedDoPrestador
        publicacoes={publicacoes}
        ativas={contagem.ativas}
        limite={contagem.limite}
        temArmazenamento={temArmazenamento}
      />
    </PageShell>
  );
}
