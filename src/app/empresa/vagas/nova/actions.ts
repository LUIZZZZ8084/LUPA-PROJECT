"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PILOT_CITY, SINOP_NEIGHBORHOODS } from "@/lib/constants";
import { clienteDeServico } from "@/lib/supabase/service";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { exigirCapacidade } from "@/server/auth/rbac";
import { erros } from "@/server/errors";
import { zTexto } from "@/server/validation";

/**
 * Publicação de vaga.
 *
 * A vaga sai vinculada à empresa da sessão, nunca a um id vindo do
 * formulário: aceitar `empresa_id` da requisição deixaria qualquer empresa
 * publicar em nome de outra.
 */
const schema = z
  .object({
    titulo: zTexto(4, 120, "O cargo"),
    descricao: zTexto(30, 5000, "A descrição"),
    categoria: z.string().trim().min(1, "Escolha uma categoria."),
    tipoContrato: z.string().trim().min(1, "Escolha o tipo de contrato."),
    bairro: z
      .enum(SINOP_NEIGHBORHOODS)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    salarioMin: z.coerce.number().nonnegative().optional(),
    salarioMax: z.coerce.number().nonnegative().optional(),
  })
  .refine(
    (v) => !v.salarioMin || !v.salarioMax || v.salarioMax >= v.salarioMin,
    { message: "O teto precisa ser maior que o piso.", path: ["salarioMax"] },
  );

export const publicarVaga = criarAcao({
  nome: "vaga.publicar",
  entrada: schema,
  executar: async (dados) => {
    const sessao = exigirCapacidade(await sessaoAtual(), "vaga:publicar");

    const supabase = clienteDeServico();
    if (!supabase) return { demo: true as const };

    const { error } = await supabase.from("vagas").insert({
      empresa_id: sessao.usuarioId,
      titulo: dados.titulo,
      descricao: dados.descricao,
      categoria: dados.categoria,
      tipo_contrato: dados.tipoContrato,
      cidade: PILOT_CITY,
      bairro: dados.bairro ?? null,
      salario_min: dados.salarioMin ?? null,
      salario_max: dados.salarioMax ?? null,
    });

    if (error) {
      // 23503 = a empresa não tem perfil ainda.
      if (error.code === "23503") {
        throw erros.conflito(
          "Complete o cadastro da empresa antes de publicar uma vaga.",
        );
      }
      throw erros.indisponivel(`publicação de vaga: ${error.message}`);
    }

    revalidatePath("/empresa");
    revalidatePath("/vagas");
    return { demo: false as const };
  },
});

/** Adaptador para useActionState, como nas telas de conta. */
export interface EstadoVaga {
  ok?: boolean;
  demo?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function publicarVagaComEstado(
  _anterior: EstadoVaga,
  formData: FormData,
): Promise<EstadoVaga> {
  const resposta = await publicarVaga(formData);

  if (resposta.ok) return { ok: true, demo: resposta.dados.demo };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
