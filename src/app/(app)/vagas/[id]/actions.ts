"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteDeServico } from "@/lib/supabase/service";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { exigirCapacidade } from "@/server/auth/rbac";
import { erros } from "@/server/errors";

/**
 * Candidatura a uma vaga CLT.
 *
 * Sem Supabase configurado, devolve sucesso sem gravar — é o modo
 * demonstração, e a interface diz isso na tela.
 */
export const candidatarSe = criarAcao({
  nome: "candidatura.criar",
  entrada: z.object({ vagaId: z.uuid("Vaga inválida.") }),
  executar: async ({ vagaId }) => {
    // Só candidato se candidata: empresa e prestador não têm a capacidade.
    const sessao = exigirCapacidade(await sessaoAtual(), "candidatura:criar");

    const supabase = clienteDeServico();
    if (!supabase) return { demo: true as const };

    const { error } = await supabase
      .from("candidaturas")
      .insert({ vaga_id: vagaId, candidato_id: sessao.usuarioId });

    if (error) {
      // 23505 = índice único (vaga_id, candidato_id).
      if (error.code === "23505") {
        throw erros.conflito("Você já se candidatou a esta vaga.");
      }
      throw erros.indisponivel(`candidatura: ${error.message}`);
    }

    revalidatePath(`/vagas/${vagaId}`);
    return { demo: false as const };
  },
});
