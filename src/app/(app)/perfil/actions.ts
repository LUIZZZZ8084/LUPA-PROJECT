"use server";

import { revalidatePath } from "next/cache";
import { sessaoAtual } from "@/server/auth/cookies";
import { verificarCnpjAutomatico } from "@/server/verificacao/servico";

/**
 * Conferir o CNPJ na Receita, a pedido de quem está na tela.
 *
 * Não passa por `criarAcao` porque não há entrada para validar: o CNPJ vem
 * do perfil gravado, nunca do formulário. Aceitar o número do cliente aqui
 * deixaria qualquer um mandar o CNPJ de uma empresa ativa alheia e sair
 * verificado.
 *
 * O serviço já devolve `{ ok, motivo }` em vez de lançar, porque cada
 * recusa tem uma frase própria e nenhuma delas é erro de programa —
 * "Receita fora do ar" e "razão social não bate" pedem respostas
 * diferentes de quem está lendo.
 */
export interface EstadoVerificacao {
  ok?: boolean;
  mensagem?: string;
}

export async function verificarCnpj(): Promise<EstadoVerificacao> {
  const resultado = await verificarCnpjAutomatico(await sessaoAtual());

  if (!resultado.ok) return { ok: false, mensagem: resultado.motivo };

  /*
   * O selo de verificado aparece no perfil e no cartão da empresa nas
   * vagas; sem revalidar, quem acabou de ser aprovado continuaria vendo
   * "não verificado" e tentaria de novo.
   */
  revalidatePath("/perfil");
  revalidatePath("/empresa");
  revalidatePath("/vagas", "layout");

  return {
    ok: true,
    mensagem: `CNPJ conferido na Receita: ${resultado.razaoSocial}. Sua empresa está verificada.`,
  };
}
