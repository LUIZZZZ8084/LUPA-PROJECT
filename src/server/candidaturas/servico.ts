import { empresaDoPainel } from "@/lib/data";
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
