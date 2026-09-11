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
import { BASES_DE_CONTRATACAO } from "./area";

/**
 * Revalida o painel das **duas** áreas de contratação.
 *
 * A action não sabe de qual porta veio o clique — `/empresa` ou
 * `/contratar` —, e não precisa saber: revalidar um caminho que a pessoa
 * não está vendo não custa nada, e deixar de revalidar o certo faz a tela
 * mentir sobre o que acabou de acontecer. Escrever `/empresa` à mão aqui
 * era o defeito silencioso que a #189 quase deixou passar.
 */
function revalidarContratacao(sufixo = "") {
  for (const base of BASES_DE_CONTRATACAO) revalidatePath(`${base}${sufixo}`);
}

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

    revalidarContratacao();
    revalidatePath("/vagas");
    revalidatePath(`/vagas/${id}`);
    return {};
  },
});

/**
 * Reativar vaga expirada: renova o prazo por 30 dias e **gasta uma vaga
 * do saldo**, como publicar (#172) — reativar de graça seria o caminho
 * óbvio para nunca mais pagar. Some do painel a marca de "expirada" e a
 * vaga volta a aparecer em `/vagas`.
 */
export const reativarVaga = criarAcao({
  nome: "vaga.reativar",
  entrada: schemaIdVaga,
  executar: async ({ id }) => {
    const sessao = await sessaoAtual();
    await reativarVagaServico(sessao, id);

    revalidarContratacao();
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

    revalidarContratacao();
    revalidatePath("/perfil");
    return {};
  },
});
