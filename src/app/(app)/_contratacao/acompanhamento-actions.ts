"use server";

import { revalidatePath } from "next/cache";
import { schemaAcompanhamento } from "@/server/acompanhamento/schemas";
import { salvarAcompanhamento as salvarAcompanhamentoServico } from "@/server/acompanhamento/servico";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { BASES_DE_CONTRATACAO } from "./area";

/**
 * Salvar a anotação e a entrevista de uma candidatura (#539).
 *
 * Revalida as duas áreas inteiras: a entrevista aparece no painel, no funil
 * e na ficha, e pode ter movido a pessoa para o estágio de entrevista.
 */
export const salvarAcompanhamento = criarAcao({
  nome: "candidatura.acompanhamento",
  entrada: schemaAcompanhamento,
  executar: async (dados) => {
    const sessao = await sessaoAtual();
    await salvarAcompanhamentoServico(sessao, dados);

    for (const base of BASES_DE_CONTRATACAO) {
      revalidatePath(base, "layout");
    }
    return {};
  },
});

export interface EstadoAcompanhamento {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function salvarAcompanhamentoComEstado(
  _anterior: EstadoAcompanhamento,
  formData: FormData,
): Promise<EstadoAcompanhamento> {
  const resposta = await salvarAcompanhamento(formData);
  if (resposta.ok) return { ok: true };
  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
