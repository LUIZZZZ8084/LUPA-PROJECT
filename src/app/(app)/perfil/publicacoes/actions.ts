"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  arquivarPublicacao,
  criarPublicacao,
  editarPublicacao,
  reativarPublicacao,
} from "@/server/publicacoes/servico";
import { zTexto } from "@/server/validation";

/**
 * Server actions de publicação.
 *
 * A sessão é lida aqui e repassada ao serviço, que decide. O serviço não
 * conhece cookie nem requisição — é o que permite testá-lo inteiro.
 */

const zId = z.uuid("Publicação inválida.");

const conteudo = {
  titulo: zTexto(3, 120, "O título"),
  corpo: zTexto(10, 3000, "O texto"),
  imagemUrl: z
    .union([z.url("Endereço de imagem inválido."), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
};

export const publicar = criarAcao({
  nome: "publicacao.criar",
  entrada: z.object(conteudo),
  executar: async (dados) => {
    const publicacao = await criarPublicacao(await sessaoAtual(), dados);
    revalidatePath("/perfil");
    return { id: publicacao.id };
  },
});

export const editar = criarAcao({
  nome: "publicacao.editar",
  entrada: z.object({
    id: zId,
    titulo: conteudo.titulo.optional(),
    corpo: conteudo.corpo.optional(),
    imagemUrl: conteudo.imagemUrl,
  }),
  executar: async ({ id, ...campos }) => {
    const publicacao = await editarPublicacao(await sessaoAtual(), id, campos);
    revalidatePath("/perfil");
    return { id: publicacao.id, atualizadoEm: publicacao.atualizadoEm };
  },
});

export const arquivar = criarAcao({
  nome: "publicacao.arquivar",
  entrada: z.object({ id: zId }),
  executar: async ({ id }) => {
    const publicacao = await arquivarPublicacao(await sessaoAtual(), id);
    revalidatePath("/perfil");
    return { id: publicacao.id, status: publicacao.status };
  },
});

export const reativar = criarAcao({
  nome: "publicacao.reativar",
  entrada: z.object({ id: zId }),
  executar: async ({ id }) => {
    const publicacao = await reativarPublicacao(await sessaoAtual(), id);
    revalidatePath("/perfil");
    return { id: publicacao.id, status: publicacao.status };
  },
});
