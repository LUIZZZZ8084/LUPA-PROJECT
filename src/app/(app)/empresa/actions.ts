"use server";

import { revalidatePath } from "next/cache";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { schemaMoverCandidatura } from "@/server/candidaturas/schemas";
import { moverCandidatura as moverCandidaturaServico } from "@/server/candidaturas/servico";
import { schemaIdVaga } from "@/server/vagas/schemas";
import {
  encerrarVaga as encerrarVagaServico,
  reativarVaga as reativarVagaServico,
} from "@/server/vagas/servico";

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

/**
 * Reativar vaga expirada: renova o prazo por 30 dias, de graça. Some do
 * painel a marca de "expirada" e volta a aparecer em `/vagas`.
 */
export const reativarVaga = criarAcao({
  nome: "vaga.reativar",
  entrada: schemaIdVaga,
  executar: async ({ id }) => {
    const sessao = await sessaoAtual();
    await reativarVagaServico(sessao, id);

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
