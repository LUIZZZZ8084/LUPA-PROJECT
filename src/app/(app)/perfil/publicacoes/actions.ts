"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  arquivarPublicacao,
  criarPublicacao,
  editarPublicacao,
  publicarTrabalho,
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

/**
 * As duas telas onde a grade de trabalhos aparece.
 *
 * O feed vive no perfil público, e desde 03/09/2026 há dois: o do
 * prestador em `/servicos/[id]` e o do candidato em `/candidatos/[id]`.
 * Revalidar só um deixaria o trabalho novo invisível na outra até o
 * próximo deploy — e a pessoa concluiria que não salvou.
 */
function revalidarVitrines() {
  revalidatePath("/servicos", "layout");
  revalidatePath("/candidatos", "layout");
}

/**
 * O que o formulário do feed manda: a foto e o texto, num envio só.
 *
 * A foto é opcional no schema porque o modo demonstração não tem Storage.
 * Onde ele existe, a tela é que exige — do mesmo jeito que o CPF da
 * ativação: o banco aceita ausente, a interface cobra.
 */
export const publicarComFoto = criarAcao({
  nome: "publicacao.publicar-trabalho",
  entrada: z.object({
    titulo: conteudo.titulo,
    corpo: conteudo.corpo,
    foto: z.instanceof(File).optional(),
  }),
  executar: async (dados) => {
    const publicacao = await publicarTrabalho(await sessaoAtual(), dados);

    revalidatePath("/perfil/publicacoes");
    revalidarVitrines();

    return { id: publicacao.id };
  },
});

export interface EstadoPublicacao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

function paraEstado(resposta: {
  ok: boolean;
  mensagem?: string;
  campos?: { campo: string; mensagem: string }[];
}): EstadoPublicacao {
  if (resposta.ok) return { ok: true };
  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}

export async function publicarComFotoComEstado(
  _anterior: EstadoPublicacao,
  formData: FormData,
): Promise<EstadoPublicacao> {
  return paraEstado(await publicarComFoto(formData));
}

export async function arquivarComEstado(
  _anterior: EstadoPublicacao,
  formData: FormData,
): Promise<EstadoPublicacao> {
  return paraEstado(await arquivar(formData));
}

export async function reativarComEstado(
  _anterior: EstadoPublicacao,
  formData: FormData,
): Promise<EstadoPublicacao> {
  return paraEstado(await reativar(formData));
}

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
    revalidatePath("/perfil/publicacoes");
    revalidarVitrines();
    return { id: publicacao.id, status: publicacao.status };
  },
});

export const reativar = criarAcao({
  nome: "publicacao.reativar",
  entrada: z.object({ id: zId }),
  executar: async ({ id }) => {
    const publicacao = await reativarPublicacao(await sessaoAtual(), id);
    revalidatePath("/perfil");
    revalidatePath("/perfil/publicacoes");
    revalidarVitrines();
    return { id: publicacao.id, status: publicacao.status };
  },
});

/**
 * Remover pela aba Serviços do perfil público.
 *
 * A aba é onde a pessoa está olhando quando decide tirar um trabalho do
 * ar, e um `<form action>` com o id preso por `bind` não precisa de campo
 * escondido nem de estado no cliente. A revalidação cobre as duas
 * vitrines, porque é onde a grade vive.
 */
export async function arquivarPelaAba(id: string): Promise<void> {
  const dados = new FormData();
  dados.set("id", id);
  await arquivar(dados);
  revalidarVitrines();
}
