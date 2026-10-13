"use server";

import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { denunciar } from "@/server/denuncias/servico";

/**
 * Denunciar vaga ou avaliação (#435).
 *
 * Fora de `(app)` como `conta/actions.ts`: o botão aparece em duas telas
 * (a vaga e o perfil do prestador), e a action não é de nenhuma delas.
 */
export const denunciarAction = criarAcao({
  nome: "denuncia.criar",
  entrada: z.object({
    alvo: z.enum(["vaga", "avaliacao", "publicacao"]),
    alvoId: z.string().min(1).max(100),
    prestadorId: z.string().max(100).optional(),
    motivo: z.enum(["golpe", "falsa", "ofensiva", "outro"], {
      message: "Escolha o motivo.",
    }),
    detalhe: z.string().trim().max(500, "Até 500 caracteres.").optional(),
  }),
  executar: async (dados) => {
    await denunciar(await sessaoAtual(), dados);
    return { recebida: true };
  },
});

export interface EstadoDenuncia {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function denunciarComEstado(
  _anterior: EstadoDenuncia,
  formData: FormData,
): Promise<EstadoDenuncia> {
  const resposta = await denunciarAction(formData);
  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
