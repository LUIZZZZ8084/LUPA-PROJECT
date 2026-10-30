import { notFound } from "next/navigation";
import { BackLink, PageShell, PageTitle } from "@/components/layout/page-shell";
import { umParametro } from "@/lib/busca";
import { sessaoOuEntrar } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { usuarioDaSessao } from "@/server/auth/servico";
import { direitoDePublicar } from "@/server/carteiras/servico";
import { modeloDeVaga } from "@/server/vagas/modelo";
import type { AreaDeContratacao } from "./area";
import { NewJobForm } from "./nova-vaga-form";

export async function PublicarVaga({
  area,
  searchParams,
}: {
  area: AreaDeContratacao;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /*
   * A cidade da empresa é só o valor inicial, não uma trava: quem tem sede
   * em Sinop e contrata em Sorriso precisa poder trocar. O que não pode é
   * fazer a empresa escolher a própria cidade toda vez que publica.
   */
  const sessao = await sessaoOuEntrar(`${area.base}/vagas/nova`);

  /*
   * Mesmo portão do painel, pela mesma razão: a página lia a sessão só
   * para preencher a cidade e nunca perguntava se aquele papel publica
   * vaga. Quem não pode chegava ao formulário inteiro e só descobria no
   * envio, quando a action recusa — formulário preenchido e recusado no
   * fim é a pior forma de dizer "isto não é para você".
   *
   * `vaga:publicar` e não a capacidade do painel: são perguntas
   * diferentes, e a segunda não diz se a pessoa publica. O admin passa
   * desde a #499, e publica só pela empresa dele.
   */
  if (!pode(sessao.papel, "vaga:publicar")) notFound();

  const modelo = await modeloDeVaga(
    sessao.usuarioId,
    umParametro(await searchParams, "modelo"),
  );
  const [usuario, direito] = await Promise.all([
    usuarioDaSessao(sessao.usuarioId),
    /*
     * O saldo vem para ca para a tela poder avisar **antes** do
     * formulario, e nao depois de dez campos preenchidos. Quem decide de
     * verdade continua sendo `gastarParaPublicar`, na hora de gravar —
     * isto aqui informa, nao autoriza.
     */
    direitoDePublicar(sessao.usuarioId),
  ]);

  return (
    <PageShell width="formulario">
      <BackLink href={area.base} label={`Voltar para ${area.nome}`} />
      <PageTitle
        title="Publicar nova vaga"
        accent="text-empresas"
        description="Quanto mais claro o anúncio, menos currículo fora do perfil você recebe."
      />
      <NewJobForm
        cidadeDaEmpresa={usuario?.cidade ?? ""}
        area={area}
        direito={direito}
        modelo={modelo}
      />
    </PageShell>
  );
}
