"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { MAXIMO_DE_PERGUNTAS } from "@/lib/triagem";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { avisarEmpresaDaCandidatura } from "@/server/candidaturas/aviso-a-empresa";
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
    const candidatura = await candidatarSeServico(sessao, vagaId, respostas);

    /*
     * O aviso à empresa sai depois da resposta (#543): quem se candidatou
     * quer a confirmação na tela, e uma volta ao Resend em conexão ruim
     * faria o botão parecer travado. Falha aqui fica no log.
     */
    after(() => avisarEmpresaDaCandidatura(candidatura));

    revalidatePath(`/vagas/${vagaId}`);
    revalidatePath("/perfil");
    return {};
  },
});
