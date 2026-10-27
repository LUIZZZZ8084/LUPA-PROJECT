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
  respostas?: readonly boolean[],
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

  /*
   * A pessoa responde a todas as perguntas da vaga antes de enviar (#491).
   *
   * Quem confere é o servidor, e não só a tela: a action pode ser chamada
   * direto, e "sem responder todas, não envia" precisa valer para quem não
   * passou pela tela. O banco tem a mesma trava (`candidaturas_confere_
   * triagem`) — esta existe para dar a mensagem antes de tentar.
   */
  const perguntas = vaga.perguntas;
  if (perguntas.length > 0) {
    const completas =
      respostas?.length === perguntas.length &&
      respostas.every((r) => typeof r === "boolean");
    if (!completas) {
      throw erros.validacao(
        [{ campo: "respostas", mensagem: "Responda a todas as perguntas." }],
        "Responda a todas as perguntas antes de enviar.",
      );
    }
  }

  const candidatura = await repositorioCandidaturas().criar({
    vagaId,
    candidatoId: autenticado.usuarioId,
    // Vaga sem pergunta não guarda resposta: o que sobrou na entrada é lixo.
    respostas: perguntas.length > 0 ? [...(respostas ?? [])] : undefined,
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
