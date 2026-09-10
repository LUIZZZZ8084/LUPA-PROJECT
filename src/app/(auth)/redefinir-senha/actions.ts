"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { criarSessao } from "@/server/auth/cookies";
import type { Papel } from "@/server/auth/rbac";
import { redefinirSenha } from "@/server/auth/recuperacao";
import { zSenha } from "@/server/validation";

/**
 * Troca a senha e já entra (#174).
 *
 * Emitir a sessão aqui não é conveniência: sem ela, a pessoa acabaria de
 * provar quem é — pelo link que só chegou ao e-mail dela — e cairia numa
 * tela de login para digitar a senha que criou trinta segundos antes.
 *
 * O que isto **não** faz é derrubar as sessões antigas. A sessão é um JWT
 * de 7 dias e não há como invalidá-la antes de expirar: é o preço
 * registrado no `AGENTS.md` desde que a sessão saiu do banco. Quem trocou
 * a senha por suspeitar de acesso indevido precisa saber disso, e a tela
 * diz.
 */
export const redefinirSenhaAction = criarAcao({
  nome: "auth.redefinir_senha",
  entrada: z.object({
    token: z.string().min(1),
    senha: zSenha,
  }),
  executar: async ({ token, senha }) => {
    const { usuarioId, papel } = await redefinirSenha(token, senha);
    await criarSessao(usuarioId, papel as Papel);
    redirect("/");
  },
});

export interface EstadoRedefinicao {
  erro?: string;
  campos?: Record<string, string>;
}

export async function redefinirComEstado(
  _anterior: EstadoRedefinicao,
  formData: FormData,
): Promise<EstadoRedefinicao> {
  const resposta = await redefinirSenhaAction(formData);
  // Em caso de sucesso a action redireciona, e isto não chega a rodar.
  if (resposta.ok) return {};

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
