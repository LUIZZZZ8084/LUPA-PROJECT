import { empresaDoPainel } from "@/lib/data";
import { type Autenticado, exigirCapacidade, exigirDono } from "../auth/rbac";
import { repositorioCandidaturas } from "../candidaturas";
import type { EventoDoHistorico } from "../candidaturas/tipos";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioVagas } from "../vagas";
import { repositorioTalentos } from "./index";

/**
 * A ficha do candidato (#618): registrar contato e salvar nos talentos.
 *
 * Os dois partem de uma candidatura, e a pergunta é a mesma de mover de
 * etapa e anotar: a conta cuida de candidatura e a candidatura é de uma
 * vaga desta empresa. Começar pela candidatura é o que prova que a pessoa
 * se candidatou — a empresa não salva quem nunca a procurou.
 */
async function candidaturaDaEmpresa(sessao: Autenticado | null, id: string) {
  const autenticado = exigirCapacidade(sessao, "candidatura:mover_estagio");
  const candidatura = await repositorioCandidaturas().porId(id);
  if (!candidatura) throw erros.naoEncontrado("Candidatura");
  const vaga = await repositorioVagas().porId(candidatura.vagaId);
  if (!vaga) throw erros.naoEncontrado("Candidatura");

  const empresaId = empresaDoPainel(autenticado.usuarioId);
  exigirDono(
    { usuarioId: empresaId, papel: autenticado.papel },
    vaga.empresaId,
    "Candidatura",
  );
  return { autenticado, candidatura, empresaId };
}

export async function registrarContato(
  sessao: Autenticado | null,
  dados: { candidaturaId: string; nota: string },
): Promise<EventoDoHistorico> {
  const { autenticado, candidatura } = await candidaturaDaEmpresa(
    sessao,
    dados.candidaturaId,
  );
  const evento = await repositorioCandidaturas().registrarContato(
    candidatura.id,
    dados.nota,
    autenticado.usuarioId,
  );
  log.info("contato registrado", {
    acao: "candidatura.contato",
    papel: autenticado.papel,
  });
  return evento;
}

export async function definirTalento(
  sessao: Autenticado | null,
  dados: { candidaturaId: string; salvo: boolean },
): Promise<void> {
  const { autenticado, candidatura, empresaId } = await candidaturaDaEmpresa(
    sessao,
    dados.candidaturaId,
  );
  if (dados.salvo) {
    await repositorioTalentos().salvar(empresaId, candidatura.candidatoId);
  } else {
    await repositorioTalentos().remover(empresaId, candidatura.candidatoId);
  }
  log.info(dados.salvo ? "talento salvo" : "talento removido", {
    acao: "talento.salvar",
    papel: autenticado.papel,
  });
}

/** Os ids das pessoas que a empresa da sessão salvou. */
export async function talentosSalvosDa(
  sessao: Autenticado | null,
): Promise<Set<string>> {
  if (!sessao) return new Set();
  return repositorioTalentos().salvosDa(empresaDoPainel(sessao.usuarioId));
}
