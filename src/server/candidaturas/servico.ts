import { empresaDoPainel } from "@/lib/data";
import { vagaExpirada } from "@/lib/format";
import { type Autenticado, exigirCapacidade, exigirDono } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioVagas } from "../vagas";
import { repositorioCandidaturas } from "./index";
import type { Candidatura, StatusCandidatura } from "./tipos";

/**
 * Regras de candidatura.
 *
 * Mover de estágio faz as mesmas duas perguntas de sempre: a empresa pode
 * mover candidatura (`exigirCapacidade`) e esta candidatura é de uma vaga
 * desta empresa (`exigirDono`, verificado através da vaga — a candidatura
 * em si não guarda o id da empresa).
 */

export async function candidatarSe(
  sessao: Autenticado | null,
  vagaId: string,
): Promise<Candidatura> {
  const autenticado = exigirCapacidade(sessao, "candidatura:criar");

  /*
   * O botão já some da tela para vaga fechada ou expirada — mas quem
   * chama a action direto não passa pela tela. Sem esta checagem, dava
   * para se candidatar a uma vaga que nem aparece mais em `/vagas`, o
   * oposto do que o prazo de 30 dias existe para evitar.
   */
  const vaga = await repositorioVagas().porId(vagaId);
  if (!vaga) throw erros.naoEncontrado("Vaga");
  if (vaga.status !== "aberta" || vagaExpirada(vaga.expiraEm)) {
    throw erros.conflito("Esta vaga não está mais recebendo candidaturas.");
  }

  const candidatura = await repositorioCandidaturas().criar({
    vagaId,
    candidatoId: autenticado.usuarioId,
  });

  log.info("candidatura criada", {
    acao: "candidatura.criar",
    papel: autenticado.papel,
  });
  return candidatura;
}

export async function moverCandidatura(
  sessao: Autenticado | null,
  id: string,
  status: StatusCandidatura,
): Promise<Candidatura> {
  const autenticado = exigirCapacidade(sessao, "candidatura:mover_estagio");

  const atual = await repositorioCandidaturas().porId(id);
  if (!atual) throw erros.naoEncontrado("Candidatura");

  const vaga = await repositorioVagas().porId(atual.vagaId);
  if (!vaga) throw erros.naoEncontrado("Candidatura");

  exigirDono(
    {
      usuarioId: empresaDoPainel(autenticado.usuarioId),
      papel: autenticado.papel,
    },
    vaga.empresaId,
    "Candidatura",
  );

  const movida = await repositorioCandidaturas().moverEstagio(id, status);
  log.info("candidatura mudou de estágio", {
    acao: "candidatura.mover_estagio",
    papel: autenticado.papel,
    status,
  });
  return movida;
}
