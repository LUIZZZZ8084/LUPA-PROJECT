"use server";

import { z } from "zod";
import { criarAcao } from "@/server/action";
import { confirmarEmail } from "@/server/auth/verificacao-email";

/**
 * Confirmar o e-mail é um clique, e não a abertura do link (#398).
 *
 * A página gastava o token no próprio carregamento. Antivírus de e-mail e
 * prévia de link abrem os endereços da mensagem para conferir, e um deles
 * podia gastar o token antes de a pessoa clicar — ela abria o link e lia
 * "Este link não vale mais". Um GET não deve mudar nada; o consumo passou
 * para esta action, que só um envio de formulário chama.
 */
export const confirmarEmailAction = criarAcao({
  nome: "auth.confirmar_email",
  entrada: z.object({ token: z.string().min(1).max(200) }),
  executar: async ({ token }) => ({ confirmado: await confirmarEmail(token) }),
});

export interface EstadoConfirmacao {
  ok?: boolean;
  confirmado?: boolean;
  erro?: string;
}

export async function confirmarComEstado(
  _anterior: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  const resposta = await confirmarEmailAction(formData);
  if (!resposta.ok) return { erro: resposta.mensagem };
  return { ok: true, confirmado: resposta.dados.confirmado };
}
