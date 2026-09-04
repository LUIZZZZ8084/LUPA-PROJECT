"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EstadoVerificacao } from "@/app/(app)/perfil/actions";
import { criarAcao } from "@/server/action";
import {
  apagarArquivoDoPerfil,
  trocarArquivoDoPerfil,
} from "@/server/arquivos/perfil";
import type { Especie } from "@/server/arquivos/regras";
import { sessaoAtual } from "@/server/auth/cookies";
import { erros } from "@/server/errors";
import {
  schemaBasico,
  schemaCandidato,
  schemaEmpresa,
  schemaPrestador,
} from "@/server/perfil/schemas";
import { salvarBasicos, salvarPerfilDoPapel } from "@/server/perfil/servico";
import { repositorioUsuarios } from "@/server/repositories";
import { definirCnpjDoPrestador } from "@/server/verificacao/servico";

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

/**
 * O CNPJ de MEI vive fora de `salvarAnuncio`, de propósito.
 *
 * `salvarPerfilPrestador` faz gravação completa do perfil de anúncio; se
 * `cnpj` estivesse nesse mesmo formulário, editar a descrição resubmeteria
 * o CNPJ todo salvamento, e uma consulta à Receita rodaria toda vez que a
 * pessoa corrigisse uma vírgula no texto. Aqui é campo e botão próprios,
 * como já vale para os arquivos.
 *
 * Não passa por `criarAcao` porque o retorno não é o par usual
 * `{ salvo }` / erro de campo — é `{ ok, mensagem }`, o mesmo formato de
 * `verificarCnpj`, porque cada recusa da Receita tem frase própria.
 * Vazio quer dizer "remover o CNPJ, voltar a ser só CPF".
 */
export async function salvarCnpjDoPrestador(
  _anterior: EstadoVerificacao,
  formData: FormData,
): Promise<EstadoVerificacao> {
  const sessao = await quemEsta();
  if (sessao.papel !== "prestador_servico") {
    throw erros.semPermissao("CNPJ de MEI é só para prestador de serviço.");
  }

  const cnpj = String(formData.get("cnpj") ?? "").trim();

  if (!cnpj) {
    await repositorioUsuarios().definirCnpjPrestador(
      sessao.usuarioId,
      null,
      false,
    );
    revalidatePath("/perfil");
    revalidatePath("/perfil/editar");
    revalidatePath("/servicos", "layout");
    return {
      ok: true,
      mensagem: "CNPJ removido. Seu perfil continua com o CPF.",
    };
  }

  const resultado = await definirCnpjDoPrestador(sessao, cnpj);
  if (!resultado.ok) return { ok: false, mensagem: resultado.motivo };

  revalidatePath("/perfil");
  revalidatePath("/perfil/editar");
  revalidatePath("/servicos", "layout");
  return {
    ok: true,
    mensagem: `CNPJ confirmado na Receita: ${resultado.razaoSocial}.`,
  };
}

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
   Arquivos
   ============================================================ */

/**
 * O arquivo vem do formulário; a espécie, não.
 *
 * Espécie vinda do cliente deixaria alguém mandar um PDF pelo campo de
 * foto, ou gravar no bucket privado passando pelo caminho do público. Cada
 * action fixa a sua, e o que o formulário controla é só o conteúdo.
 */
const schemaArquivo = z.object({
  arquivo: z
    .instanceof(File, { message: "Escolha um arquivo." })
    .refine((f) => f.size > 0, "Escolha um arquivo."),
});

function acaoDeEnvio(nome: string, especie: Especie) {
  return criarAcao({
    nome,
    entrada: schemaArquivo,
    executar: async ({ arquivo }) => {
      const { usuarioId, papel } = await quemEsta();
      await trocarArquivoDoPerfil(usuarioId, papel, especie, arquivo);

      // O cabeçalho e a busca mostram a imagem: sem isto, continuam com a
      // anterior até a próxima navegação dura.
      revalidatePath("/", "layout");
      revalidatePath("/perfil");
      return { salvo: true };
    },
  });
}

function acaoDeRemocao(nome: string, especie: Especie) {
  return criarAcao({
    nome,
    entrada: z.object({}),
    executar: async () => {
      const { usuarioId, papel } = await quemEsta();
      await apagarArquivoDoPerfil(usuarioId, papel, especie);

      revalidatePath("/", "layout");
      revalidatePath("/perfil");
      return { salvo: true };
    },
  });
}

export const enviarFoto = acaoDeEnvio("perfil.foto", "avatar");
export const enviarLogo = acaoDeEnvio("perfil.logo", "logo");
export const enviarCurriculo = acaoDeEnvio("perfil.curriculo-pdf", "curriculo");

export const removerFoto = acaoDeRemocao("perfil.foto-remover", "avatar");
export const removerLogo = acaoDeRemocao("perfil.logo-remover", "logo");
export const removerCurriculo = acaoDeRemocao(
  "perfil.curriculo-pdf-remover",
  "curriculo",
);

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

export async function enviarFotoComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await enviarFoto(formData));
}

export async function enviarLogoComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await enviarLogo(formData));
}

export async function enviarCurriculoComEstado(
  _anterior: EstadoEdicao,
  formData: FormData,
): Promise<EstadoEdicao> {
  return paraEstado(await enviarCurriculo(formData));
}
