"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { avisarVagaNova } from "@/server/notificacoes/servico";
import { schemaNovaVaga } from "@/server/vagas/schemas";
import { publicarVaga as publicarVagaServico } from "@/server/vagas/servico";
import { BASES_DE_CONTRATACAO } from "./area";

/**
 * Publicação de vaga.
 *
 * A vaga sai vinculada à empresa da sessão, nunca a um id vindo do
 * formulário: aceitar `empresa_id` da requisição deixaria qualquer empresa
 * publicar em nome de outra. Quem decide isso é o serviço, não a action.
 */
export const publicarVaga = criarAcao({
  nome: "vaga.publicar",
  entrada: schemaNovaVaga,
  executar: async (dados) => {
    const sessao = await sessaoAtual();
    const vaga = await publicarVagaServico(sessao, dados);

    /*
     * O aviso sai depois da resposta (#48).
     *
     * Quem publicou quer a vaga no ar; o push é consequência. Numa lista
     * grande de interessados isso é uma volta de rede por aparelho, e
     * segurar a tela por causa disso faria a publicação parecer travada em
     * conexão ruim — que é a conexão do público daqui.
     *
     * Falha aqui vai para o log e a vaga segue publicada, a mesma
     * disciplina do registro de visualização.
     */
    after(() => avisarVagaNova(vaga));

    /*
     * As duas areas de contratacao, nao so `/empresa` (#193).
     *
     * A #189 corrigiu isto em `actions.ts` e `creditos-actions.ts` e
     * **passou batido aqui**: quem publicava pelo `/contratar` voltava
     * para um painel que nao mostrava a vaga recem-criada. Mesma licao do
     * `perfis_empresa.plano`, que apareceu em tres telas — corrigir num
     * arquivo nao corrige os irmaos.
     */
    for (const base of BASES_DE_CONTRATACAO) revalidatePath(base);
    revalidatePath("/vagas");
    return {};
  },
});

/** Adaptador para useActionState, como nas telas de conta. */
export interface EstadoVaga {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function publicarVagaComEstado(
  _anterior: EstadoVaga,
  formData: FormData,
): Promise<EstadoVaga> {
  const resposta = await publicarVaga(formData);

  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
