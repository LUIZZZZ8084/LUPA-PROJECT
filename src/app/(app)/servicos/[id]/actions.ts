"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { avaliarPrestador } from "@/server/avaliacoes/servico";
import { zTexto } from "@/server/validation";

/**
 * Avaliar um prestador.
 *
 * O id do prestador vem do formulário porque é o alvo público da página —
 * diferente do id de quem avalia, que vem da sessão e nunca do cliente. É
 * a mesma divisão do resto da casa: o que se está olhando pode vir da URL;
 * quem está olhando, não.
 */
export const avaliar = criarAcao({
  nome: "avaliacao.criar",
  entrada: z.object({
    prestadorId: z.string().min(1, "Prestador inválido."),
    nota: z.coerce
      .number()
      .int()
      .min(1, "Escolha de 1 a 5 estrelas.")
      .max(5, "Escolha de 1 a 5 estrelas."),
    comentario: z.preprocess(
      (v) => (v === "" ? null : v),
      zTexto(3, 1000, "O comentário").nullable(),
    ),
  }),
  executar: async ({ prestadorId, nota, comentario }) => {
    await avaliarPrestador(await sessaoAtual(), {
      prestadorId,
      nota,
      comentario,
    });

    // A nota média e a contagem mudam com a avaliação nova, e as duas
    // aparecem também na busca.
    revalidatePath(`/servicos/${prestadorId}`);
    revalidatePath("/servicos");

    return { avaliado: true };
  },
});

export interface EstadoAvaliacao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function avaliarComEstado(
  _anterior: EstadoAvaliacao,
  formData: FormData,
): Promise<EstadoAvaliacao> {
  const resposta = await avaliar(formData);
  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
