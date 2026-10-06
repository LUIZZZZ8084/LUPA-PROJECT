"use server";

import { z } from "zod";
import { criarAcao } from "@/server/action";
import { pedirRecuperacao } from "@/server/auth/recuperacao";
import { erros } from "@/server/errors";
import { origemDaRequisicao } from "@/server/origem-da-requisicao";
import { urlPublica } from "@/server/url-publica";

/**
 * Pede o e-mail de recuperação (#174).
 *
 * A origem sai do cabeçalho confiável da borda, não do formulário nem do
 * primeiro item — forjável — de `x-forwarded-for` (#346): o limite existe
 * para conter quem manda e-mail em massa em nome da Lupa, e um valor que o
 * cliente escolhe não limita ninguém. Mesma regra do limite de cadastro.
 */
export const pedirRecuperacaoDeSenha = criarAcao({
  nome: "auth.pedir_recuperacao",
  entrada: z.object({
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
  }),
  executar: async ({ email }) => {
    const origem = await origemDaRequisicao();

    const resultado = await pedirRecuperacao(email, {
      origem,
      urlBase: urlPublica(),
    });

    if (!resultado.ok) {
      throw erros.validacao([{ campo: "email", mensagem: resultado.motivo }]);
    }
    return {};
  },
});

export interface EstadoRecuperacao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function pedirComEstado(
  _anterior: EstadoRecuperacao,
  formData: FormData,
): Promise<EstadoRecuperacao> {
  const resposta = await pedirRecuperacaoDeSenha(formData);
  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
