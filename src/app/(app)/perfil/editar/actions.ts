"use server";

import { revalidatePath } from "next/cache";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { erros } from "@/server/errors";
import {
  schemaBasico,
  schemaCandidato,
  schemaEmpresa,
  schemaPrestador,
} from "@/server/perfil/schemas";
import { salvarBasicos, salvarPerfilDoPapel } from "@/server/perfil/servico";

/**
 * Salvar o próprio perfil.
 *
 * A action lê a sessão e passa o id adiante; o serviço nunca recebe id
 * vindo do formulário. É o que torna impossível a classe de bug em que
 * alguém troca um campo escondido e edita o perfil de outra pessoa — não
 * existe alvo para trocar.
 */

/**
 * O papel também vem da sessão, não do formulário.
 *
 * O formulário é palpite do cliente sobre o que existe. Aceitar o papel
 * dali deixaria um candidato postar campos de prestador e ganhar um
 * anúncio na busca sem nunca ter passado pelo cadastro de prestador.
 */
async function quemEsta() {
  const sessao = await sessaoAtual();
  if (!sessao) throw erros.naoAutenticado();
  return sessao;
}

/** Só os campos de `usuarios`, comuns a todos os papéis. */
export const salvarConta = criarAcao({
  nome: "perfil.conta",
  entrada: schemaBasico,
  executar: async (dados) => {
    const { usuarioId } = await quemEsta();
    await salvarBasicos(usuarioId, dados);

    // O cabeçalho mostra nome e avatar: sem isto ele fica com o nome velho.
    revalidatePath("/", "layout");
    return { salvo: true };
  },
});

export const salvarCurriculo = criarAcao({
  nome: "perfil.curriculo",
  entrada: schemaCandidato,
  executar: async (dados) => {
    const { usuarioId, papel } = await quemEsta();
    await salvarPerfilDoPapel(usuarioId, papel, dados);
    revalidatePath("/perfil");
    return { salvo: true };
  },
});

export const salvarAnuncio = criarAcao({
  nome: "perfil.anuncio",
  entrada: schemaPrestador,
  executar: async (dados) => {
    const { usuarioId, papel } = await quemEsta();
    await salvarPerfilDoPapel(usuarioId, papel, dados);

    // O anúncio aparece na busca e no perfil público do prestador.
    revalidatePath("/servicos");
    revalidatePath(`/servicos/${usuarioId}`);
    revalidatePath("/perfil");
    return { salvo: true };
  },
});

export const salvarEmpresa = criarAcao({
  nome: "perfil.empresa",
  entrada: schemaEmpresa,
  executar: async (dados) => {
    const { usuarioId, papel } = await quemEsta();
    await salvarPerfilDoPapel(usuarioId, papel, dados);
    revalidatePath("/empresa");
    revalidatePath("/perfil");
    return { salvo: true };
  },
});

/* ============================================================
   Ponte para useActionState
   ============================================================ */

export interface EstadoEdicao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

function paraEstado(resposta: {
  ok: boolean;
  mensagem?: string;
  campos?: { campo: string; mensagem: string }[];
}): EstadoEdicao {
  if (resposta.ok) return { ok: true };
  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}

export async function salvarContaComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await salvarConta(formData));
}

export async function salvarCurriculoComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await salvarCurriculo(formData));
}

export async function salvarAnuncioComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await salvarAnuncio(formData));
}

export async function salvarEmpresaComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await salvarEmpresa(formData));
}
