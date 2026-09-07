"use server";

import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import {
  schemaInscricao,
  schemaPreferencia,
} from "@/server/notificacoes/schemas";
import {
  desligarAvisos,
  inscreverAparelho,
  salvarPreferencia,
} from "@/server/notificacoes/servico";

/**
 * Avisos de vaga nova (#48).
 *
 * Ficam em arquivo próprio, e não junto das actions de perfil, porque são
 * assunto separado com botão separado — a mesma razão que já divide o
 * formulário de perfil em um por assunto. Um erro ao inscrever o aparelho
 * não pode impedir alguém de corrigir o telefone.
 */

export const salvarAvisos = criarAcao({
  nome: "notificacao.preferencia",
  entrada: schemaPreferencia,
  executar: async (dados) => {
    const sessao = await sessaoAtual();
    await salvarPreferencia(sessao, {
      cidade: dados.cidade,
      // "" no formulário significa "todas as áreas".
      categoria: dados.categoria || null,
    });
    return {};
  },
});

export const desligarAvisosDeVaga = criarAcao({
  nome: "notificacao.desligar",
  // Nada a validar: desligar não recebe campo nenhum. O objeto vazio é o
  // que `criarAcao` espera para dizer "esta action não tem entrada".
  entrada: z.object({}),
  executar: async () => {
    await desligarAvisos(await sessaoAtual());
    return {};
  },
});

/**
 * Guarda o aparelho.
 *
 * O id de quem é vem da sessão, nunca do corpo: aceitar `usuarioId` daqui
 * deixaria alguém inscrever o próprio aparelho em nome de outra pessoa e
 * passar a receber os avisos dela.
 */
export const inscrever = criarAcao({
  nome: "notificacao.inscrever",
  entrada: schemaInscricao,
  executar: async (dados) => {
    await inscreverAparelho(await sessaoAtual(), dados);
    return {};
  },
});
