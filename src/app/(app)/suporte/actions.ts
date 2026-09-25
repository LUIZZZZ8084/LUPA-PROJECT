"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { usuarioDaSessao } from "@/server/auth/servico";
import { receberMensagemDeSuporte } from "@/server/suporte/servico";
import { ASSUNTOS } from "@/server/suporte/tipos";

/**
 * Enviar uma mensagem de suporte (#235).
 *
 * A action é fina, como todas: valida com Zod, lê a sessão e chama o
 * serviço. A regra — gravar, avisar, limitar por origem — mora em
 * `src/server/suporte/servico.ts`, que não conhece requisição.
 */
export const enviarMensagemDeSuporte = criarAcao({
  nome: "suporte.enviar",
  entrada: z.object({
    nome: z.string().trim().min(2, "Diga como podemos te chamar.").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    assunto: z.enum(
      Object.keys(ASSUNTOS) as [
        keyof typeof ASSUNTOS,
        ...(keyof typeof ASSUNTOS)[],
      ],
    ),
    mensagem: z
      .string()
      .trim()
      .min(10, "Conte um pouco mais do que aconteceu.")
      .max(4000),
  }),
  executar: async (dados) => {
    /*
     * A sessão entra se existir, e não é exigida.
     *
     * Quem não consegue entrar é justamente quem mais precisa do suporte —
     * exigir login aqui fecharia a porta na cara do caso mais comum. Quando
     * há sessão, o id vai junto: economiza a pessoa ter que explicar quem
     * é, e é o dado que mais acelera a resposta.
     */
    const sessao = await sessaoAtual();

    const cabecalhos = await headers();
    const origem =
      cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "desconhecida";

    await receberMensagemDeSuporte({
      ...dados,
      usuarioId: sessao?.usuarioId ?? null,
      origem,
    });

    return { enviada: true };
  },
});

export interface EstadoSuporte {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

/** Envelope para `useActionState`, no formato que o formulário espera. */
export async function enviarComEstado(
  _anterior: EstadoSuporte,
  formData: FormData,
): Promise<EstadoSuporte> {
  const resposta = await enviarMensagemDeSuporte(formData);

  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}

/**
 * O nome e o e-mail de quem já está conectado, para o formulário vir
 * preenchido.
 *
 * Pedir de novo o que a conta já sabe é atrito puro — e aqui ele cai sobre
 * alguém que já está com um problema.
 */
export async function contatoDaSessao(): Promise<{
  nome: string;
  email: string;
} | null> {
  const sessao = await sessaoAtual();
  if (!sessao) return null;

  const usuario = await usuarioDaSessao(sessao.usuarioId);
  if (!usuario) return null;

  return { nome: usuario.nomeCompleto, email: usuario.email };
}
