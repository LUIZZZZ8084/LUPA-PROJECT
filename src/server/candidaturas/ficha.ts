import "server-only";

import { empresaDoPainel, getCompanyApplications } from "@/lib/data";
import type { ApplicationWithCandidate } from "@/lib/types";
import { linkDoCurriculo } from "../arquivos/perfil";
import type { Autenticado } from "../auth/rbac";
import { temPainelDeEmpresa } from "../visualizacoes/servico";
import { repositorioCandidaturas } from "./index";

/**
 * A ficha de uma candidatura, para a empresa dona da vaga.
 *
 * É uma ficha de candidatura, e não um perfil de candidato — a diferença
 * decide o produto. Perfil navegável transformaria a Lupa num banco de
 * talentos com busca ativa, que está fora do escopo por decisão, e abriria
 * o currículo de quem procura emprego para qualquer empresa cadastrada.
 * Isso é o oposto da razão de o currículo ficar fora de toda view pública:
 * nem todo mundo quer que o patrão atual descubra que está procurando.
 *
 * Aqui o limite é um fato do arranjo: **a empresa vê este candidato porque
 * ele se candidatou à vaga dela.** É o ato de se candidatar que autoriza o
 * contato, e é ele que delimita o alcance.
 */

export interface FichaDaCandidatura {
  candidatura: ApplicationWithCandidate;
  /** Link assinado, de curta duração. Nasce a cada visita. */
  linkCurriculo: string | null;
}

/**
 * Devolve `null` tanto para "não existe" quanto para "não é sua".
 *
 * Um erro diferente para cada caso confirmaria, para quem sonda ids, que a
 * candidatura existe — e aqui o que existe é o nome e o telefone de uma
 * pessoa procurando emprego. A tela chama `notFound()` nos dois casos.
 */
export async function fichaDaCandidatura(
  sessao: Autenticado | null,
  id: string,
): Promise<FichaDaCandidatura | null> {
  /*
   * A mesma pergunta que o painel faz, e não uma cópia dela: em produção
   * só empresa; em demonstração qualquer conta, porque ali o painel
   * inteiro é o da empresa fictícia. Duas cópias divergiriam, e foi o que
   * aconteceu na primeira versão disto — a lista mostrava o candidato e a
   * ficha respondia "não encontrado".
   */
  if (!sessao || !temPainelDeEmpresa(sessao)) return null;

  /*
   * A busca é sempre pelas candidaturas *desta* empresa, e o id vindo da
   * URL só escolhe uma dentro dessa lista. Buscar a candidatura primeiro e
   * conferir o dono depois daria o mesmo resultado hoje e abriria a porta
   * para alguém, um dia, esquecer a segunda metade.
   */
  const empresaId = empresaDoPainel(sessao.usuarioId);
  const daEmpresa = await getCompanyApplications(empresaId);
  const candidatura = daEmpresa.find((c) => c.id === id);
  if (!candidatura) return null;

  return {
    candidatura,
    linkCurriculo: await linkDoCurriculo(candidatura.candidate.resume_url),
  };
}

/**
 * Abrir a ficha marca a candidatura como visualizada.
 *
 * Antes, "visualizada" era um estágio que a empresa precisava lembrar de
 * marcar depois de olhar — burocracia que ninguém faz, e por isso o estágio
 * não significava nada. Automático, "Nova" passa a querer dizer uma coisa
 * verificável: ninguém desta empresa abriu ainda.
 *
 * Só avança a partir de `enviada`. Quem já está em entrevista ou aprovada
 * não volta para trás por alguém ter reaberto a ficha — perder o estágio de
 * um candidato é perder o trabalho de triagem de quem estava conduzindo.
 */
export async function marcarComoVisualizada(id: string): Promise<void> {
  const atual = await repositorioCandidaturas().porId(id);
  if (!atual || atual.status !== "enviada") return;

  await repositorioCandidaturas().moverEstagio(id, "visualizada");
}
