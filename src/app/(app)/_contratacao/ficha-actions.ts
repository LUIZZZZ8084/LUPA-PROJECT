"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  definirTalento as definirTalentoServico,
  registrarContato as registrarContatoServico,
} from "@/server/talentos/servico";
import { BASES_DE_CONTRATACAO } from "./area";

/*
 * As ações da ficha do candidato (#618). Revalidam as duas áreas inteiras,
 * como o acompanhamento: o histórico e o selo de talento aparecem na ficha,
 * e o processo parado do painel lê a última movimentação.
 */
function revalidarAreas() {
  for (const base of BASES_DE_CONTRATACAO) revalidatePath(base, "layout");
}

const schemaContato = z.object({
  candidaturaId: z.string().trim().min(1, "Candidatura inválida."),
  nota: z
    .string()
    .trim()
    .min(1, "Escreva o que foi conversado.")
    .max(500, "O registro tem no máximo 500 letras."),
});

export const registrarContato = criarAcao({
  nome: "candidatura.contato",
  entrada: schemaContato,
  executar: async (dados) => {
    await registrarContatoServico(await sessaoAtual(), dados);
    revalidarAreas();
    return {};
  },
});

export interface EstadoContato {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function registrarContatoComEstado(
  _anterior: EstadoContato,
  formData: FormData,
): Promise<EstadoContato> {
  const resposta = await registrarContato(formData);
  if (resposta.ok) return { ok: true };
  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}

export const definirTalento = criarAcao({
  nome: "talento.salvar",
  entrada: z.object({
    candidaturaId: z.string().trim().min(1, "Candidatura inválida."),
    salvo: z.boolean(),
  }),
  executar: async (dados) => {
    await definirTalentoServico(await sessaoAtual(), dados);
    revalidarAreas();
    return {};
  },
});
