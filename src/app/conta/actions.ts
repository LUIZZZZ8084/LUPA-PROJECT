"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { criarSessao, encerrarSessao } from "@/server/auth/cookies";
import { schemaCadastro, schemaLogin } from "@/server/auth/schemas";
import { cadastrar, entrar } from "@/server/auth/servico";

/**
 * Server actions de conta.
 *
 * São finas de propósito: validam pelo envelope, chamam a regra de negócio e
 * gravam o cookie. Toda decisão está em `src/server/auth/servico.ts`, que é
 * testável sem servidor.
 */

export const cadastrarConta = criarAcao({
  nome: "auth.cadastrar",
  entrada: schemaCadastro,
  executar: async (dados) => {
    const usuario = await cadastrar(dados);

    // Entra já logado: pedir que a pessoa faça login logo depois de criar a
    // conta é um passo a mais para abandonar.
    await criarSessao(usuario.id, usuario.papel);

    revalidatePath("/", "layout");

    return {
      id: usuario.id,
      papel: usuario.papel,
      nomeCompleto: usuario.nomeCompleto,
    };
  },
});

export const entrarNaConta = criarAcao({
  nome: "auth.entrar",
  entrada: schemaLogin,
  executar: async (dados) => {
    const usuario = await entrar(dados);
    await criarSessao(usuario.id, usuario.papel);

    revalidatePath("/", "layout");

    return {
      id: usuario.id,
      papel: usuario.papel,
      nomeCompleto: usuario.nomeCompleto,
    };
  },
});

export const sairDaConta = criarAcao({
  nome: "auth.sair",
  entrada: z.object({}),
  executar: async () => {
    await encerrarSessao();
    revalidatePath("/", "layout");
    return { encerrada: true };
  },
});

/* ============================================================
   Adaptadores para useActionState
   ============================================================ */

export interface EstadoFormulario {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
  papel?: string;
}

/**
 * `criarAcao` devolve `RespostaAcao`; `useActionState` espera
 * `(estadoAnterior, formData)`. Estes adaptadores fazem a ponte, sem que a
 * regra de negócio precise saber que existe um formulário do outro lado.
 */
function paraEstado(
  resposta: Awaited<ReturnType<typeof cadastrarConta>>,
): EstadoFormulario {
  if (resposta.ok) {
    return { ok: true, papel: resposta.dados.papel };
  }

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}

export async function cadastrarComEstado(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  return paraEstado(await cadastrarConta(formData));
}

export async function entrarComEstado(
  _anterior: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const resposta = await entrarNaConta(formData);

  if (resposta.ok) return { ok: true, papel: resposta.dados.papel };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
