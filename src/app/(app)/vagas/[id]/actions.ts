"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { candidatarSe as candidatarSeServico } from "@/server/candidaturas/servico";

/**
 * Candidatura a uma vaga CLT.
 *
 * O id não precisa ter forma de uuid: em demonstração a vaga vive no
 * repositório em memória, com id gerado por `crypto.randomUUID()`, mas os
 * dados de exemplo semeados usam ids como "job-operador-maquinas".
 */
export const candidatarSe = criarAcao({
  nome: "candidatura.criar",
  entrada: z.object({ vagaId: z.string().trim().min(1, "Vaga inválida.") }),
  executar: async ({ vagaId }) => {
    const sessao = await sessaoAtual();
    await candidatarSeServico(sessao, vagaId);

    revalidatePath(`/vagas/${vagaId}`);
    revalidatePath("/perfil");
    return {};
  },
});
