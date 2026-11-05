import { empresaDoPainel } from "@/lib/data";
import { type Autenticado, exigirCapacidade, exigirDono } from "../auth/rbac";
import { repositorioCandidaturas } from "../candidaturas";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioVagas } from "../vagas";
import { repositorioAcompanhamento } from "./index";
import type { Acompanhamento, DadosAcompanhamento } from "./tipos";

/**
 * Anotar e marcar entrevista (#539).
 *
 * As mesmas duas perguntas de mover o estágio, e pelo mesmo caminho: a conta
 * pode cuidar de candidatura (`candidatura:mover_estagio`) e a candidatura é
 * de uma vaga desta empresa. Quem escreve é quem conduz o processo — não há
 * capacidade nova porque não há papel novo.
 */
export async function salvarAcompanhamento(
  sessao: Autenticado | null,
  dados: DadosAcompanhamento,
): Promise<Acompanhamento> {
  const autenticado = exigirCapacidade(sessao, "candidatura:mover_estagio");

  const candidatura = await repositorioCandidaturas().porId(
    dados.candidaturaId,
  );
  if (!candidatura) throw erros.naoEncontrado("Candidatura");
  const vaga = await repositorioVagas().porId(candidatura.vagaId);
  if (!vaga) throw erros.naoEncontrado("Candidatura");

  exigirDono(
    {
      usuarioId: empresaDoPainel(autenticado.usuarioId),
      papel: autenticado.papel,
    },
    vaga.empresaId,
    "Candidatura",
  );

  const salvo = await repositorioAcompanhamento().salvar(dados);

  /*
   * Marcar a entrevista leva a pessoa ao estágio de entrevista, quando ela
   * ainda estava antes dele. É o que a empresa faria logo em seguida, à mão,
   * e esquecer deixaria o "Em entrevista" do painel contando menos gente do
   * que a lista de próximas entrevistas. Quem já foi selecionado ou
   * dispensado não volta para trás por isso.
   */
  if (
    salvo.entrevistaEm &&
    (candidatura.status === "enviada" || candidatura.status === "visualizada")
  ) {
    await repositorioCandidaturas().moverEstagio(candidatura.id, "entrevista");
  }

  log.info("acompanhamento salvo", {
    acao: "candidatura.acompanhamento",
    papel: autenticado.papel,
    comEntrevista: Boolean(salvo.entrevistaEm),
  });
  return salvo;
}

/**
 * O acompanhamento de cada candidatura desta lista, por id.
 *
 * Quem chama já filtrou as candidaturas pela empresa da sessão — a ficha, o
 * funil e o painel leem `getCompanyApplications` da empresa —, e isto só
 * completa a lista. Por isso não recebe sessão: o alcance é o da lista.
 */
export async function acompanhamentosDe(
  candidaturaIds: readonly string[],
): Promise<Map<string, Acompanhamento>> {
  const lista =
    await repositorioAcompanhamento().porCandidaturas(candidaturaIds);
  return new Map(lista.map((a) => [a.candidaturaId, a]));
}
