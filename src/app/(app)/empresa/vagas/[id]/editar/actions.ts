"use server";

import { revalidatePath } from "next/cache";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { schemaEdicaoVaga } from "@/server/vagas/schemas";
import { editarVaga as editarVagaServico } from "@/server/vagas/servico";

export const editarVaga = criarAcao({
  nome: "vaga.editar",
  entrada: schemaEdicaoVaga,
  executar: async (dados) => {
    const sessao = await sessaoAtual();
    const { id, ...campos } = dados;
    await editarVagaServico(sessao, id, campos);

    revalidatePath("/empresa");
    revalidatePath("/vagas");
    revalidatePath(`/vagas/${id}`);
    return {};
  },
});

/** Adaptador para useActionState, como nas telas de conta. */
export interface EstadoEdicaoVaga {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function editarVagaComEstado(
  _anterior: EstadoEdicaoVaga,
  formData: FormData,
): Promise<EstadoEdicaoVaga> {
  const resposta = await editarVaga(formData);

  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
