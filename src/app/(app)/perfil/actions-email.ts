"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { enviarVerificacaoDeEmail } from "@/server/auth/verificacao-email";
import { erros } from "@/server/errors";
import { urlPublica } from "@/server/url-publica";

/**
 * Reenviar a confirmação de e-mail (#227).
 *
 * O limite é **por origem**, dentro do serviço, e não por conta: quem
 * quisesse usar isto como canal para mandar e-mail em nome da Lupa
 * trocaria de conta a cada tentativa, e quem paga a reputação do domínio
 * somos nós. Mesma escolha do cadastro e da recuperação de senha.
 */
export const reenviarConfirmacao = criarAcao({
  nome: "auth.reenviar_confirmacao",
  entrada: z.object({}),
  executar: async () => {
    const sessao = await sessaoAtual();
    if (!sessao) throw erros.naoAutenticado();

    const cabecalhos = await headers();
    const origem =
      cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "desconhecida";

    const resultado = await enviarVerificacaoDeEmail(sessao.usuarioId, {
      urlBase: urlPublica(),
      origem,
    });

    if (!resultado.ok) {
      throw erros.indisponivel(
        resultado.motivo ?? "Não foi possível enviar agora.",
      );
    }

    return { enviado: true };
  },
});

export interface EstadoReenvio {
  ok?: boolean;
  mensagem?: string;
}

/**
 * O envelope para `useActionState`, no formato que o formulário espera.
 *
 * O primeiro argumento é o estado anterior, que aqui não decide nada: o
 * botão faz a mesma coisa toda vez.
 */
export async function reenviarComEstado(
  _anterior: EstadoReenvio,
): Promise<EstadoReenvio> {
  const resposta = await reenviarConfirmacao(new FormData());
  return resposta.ok
    ? { ok: true, mensagem: "Enviado. Confira a sua caixa de entrada." }
    : { ok: false, mensagem: resposta.mensagem };
}
