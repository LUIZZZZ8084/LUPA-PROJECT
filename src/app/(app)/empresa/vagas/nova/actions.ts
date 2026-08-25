"use server";

import { revalidatePath } from "next/cache";
import { PILOT_CITY } from "@/lib/constants";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { schemaNovaVaga } from "@/server/vagas/schemas";
import { publicarVaga as publicarVagaServico } from "@/server/vagas/servico";

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
    await publicarVagaServico(sessao, { ...dados, cidade: PILOT_CITY });

    revalidatePath("/empresa");
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
