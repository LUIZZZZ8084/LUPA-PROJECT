"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAXIMO_DE_PERGUNTAS } from "@/lib/triagem";
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
  entrada: z.object({
    vagaId: z.string().trim().min(1, "Vaga inválida."),
    /*
     * As respostas às perguntas de triagem (#491), na ordem delas. Quem
     * decide se são as certas é o serviço, que conhece a vaga: aqui só se
     * garante que é uma lista curta de verdadeiro e falso.
     */
    respostas: z.array(z.boolean()).max(MAXIMO_DE_PERGUNTAS).optional(),
  }),
  executar: async ({ vagaId, respostas }) => {
    const sessao = await sessaoAtual();
    await candidatarSeServico(sessao, vagaId, respostas);

    revalidatePath(`/vagas/${vagaId}`);
    revalidatePath("/perfil");
    return {};
  },
});
