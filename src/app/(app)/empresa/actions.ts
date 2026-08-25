"use server";

import { revalidatePath } from "next/cache";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
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
