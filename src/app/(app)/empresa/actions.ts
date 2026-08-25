"use server";

import { revalidatePath } from "next/cache";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { schemaMoverCandidatura } from "@/server/candidaturas/schemas";
import { moverCandidatura as moverCandidaturaServico } from "@/server/candidaturas/servico";
import { schemaIdVaga } from "@/server/vagas/schemas";
import { encerrarVaga as encerrarVagaServico } from "@/server/vagas/servico";

/**
 * Encerrar vaga: some da busca pública, mas as candidaturas já recebidas
 * continuam no painel — encerrar não é apagar.
 */
export const encerrarVaga = criarAcao({
  nome: "vaga.encerrar",
  entrada: schemaIdVaga,
  executar: async ({ id }) => {
    const sessao = await sessaoAtual();
    await encerrarVagaServico(sessao, id);

    revalidatePath("/empresa");
    revalidatePath("/vagas");
    revalidatePath(`/vagas/${id}`);
    return {};
  },
});

/** Mudar o estágio de uma candidatura — vai para o perfil de quem se candidatou. */
export const moverCandidatura = criarAcao({
  nome: "candidatura.mover_estagio",
  entrada: schemaMoverCandidatura,
  executar: async ({ id, status }) => {
    const sessao = await sessaoAtual();
    await moverCandidaturaServico(sessao, id, status);

    revalidatePath("/empresa");
    revalidatePath("/perfil");
    return {};
  },
});
