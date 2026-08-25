import { empresaDoPainel } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  type Autenticado,
  exigirCapacidade,
  exigirDono,
  pode,
} from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioVagas } from "./index";
import type { DadosNovaVaga, EdicaoVaga, Vaga } from "./tipos";

/**
 * Regras de vaga no painel da empresa.
 *
 * Cada operação de escrita faz duas perguntas, sempre nesta ordem: o papel
 * pode fazer isto (`exigirCapacidade`) e esta vaga é desta empresa
 * (`exigirDono`). Só a primeira deixaria qualquer empresa autenticada
 * alcançar a vaga de outra trocando o id na URL.
 */

/**
 * Em produção a empresa é sempre a da sessão. Em demonstração o painel
 * mostra sempre a mesma empresa fictícia (`empresaDoPainel`, em
 * `src/lib/data.ts`) — sem isso, uma vaga publicada por uma conta de
 * demonstração recém-criada nunca apareceria no painel que a exibe.
 */
function idDaEmpresa(sessao: Autenticado): string {
  return isSupabaseConfigured
    ? sessao.usuarioId
    : empresaDoPainel(sessao.usuarioId);
}

async function vagaDaEmpresa(sessao: Autenticado, id: string): Promise<Vaga> {
  const atual = await repositorioVagas().porId(id);
  if (!atual) throw erros.naoEncontrado("Vaga");

  exigirDono(
    { usuarioId: idDaEmpresa(sessao), papel: sessao.papel },
    atual.empresaId,
    "Vaga",
  );
  return atual;
}

export async function publicarVaga(
  sessao: Autenticado | null,
  dados: Omit<DadosNovaVaga, "empresaId" | "cidade"> & { cidade: string },
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:publicar");

  const vaga = await repositorioVagas().criar({
    ...dados,
    empresaId: idDaEmpresa(autenticado),
  });

  log.info("vaga publicada", {
    acao: "vaga.publicar",
    papel: autenticado.papel,
  });
  return vaga;
}

export async function editarVaga(
  sessao: Autenticado | null,
  id: string,
  campos: EdicaoVaga,
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:editar_propria");
  await vagaDaEmpresa(autenticado, id);

  const vaga = await repositorioVagas().atualizar(id, campos);
  log.info("vaga editada", { acao: "vaga.editar", papel: autenticado.papel });
  return vaga;
}

/**
 * Busca para a tela de edição: `null` cobre tanto "não existe" quanto
 * "não é sua", igual à regra de 404 em vez de 403 — um erro diferente para
 * cada caso confirmaria, para quem sonda ids, que a vaga existe.
 */
export async function vagaParaEditar(
  sessao: Autenticado | null,
  id: string,
): Promise<Vaga | null> {
  if (!sessao || !pode(sessao.papel, "vaga:editar_propria")) return null;

  const atual = await repositorioVagas().porId(id);
  if (!atual) return null;
  if (sessao.papel !== "admin" && atual.empresaId !== idDaEmpresa(sessao)) {
    return null;
  }

  return atual;
}

export async function encerrarVaga(
  sessao: Autenticado | null,
  id: string,
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:encerrar_propria");
  await vagaDaEmpresa(autenticado, id);

  const vaga = await repositorioVagas().encerrar(id);
  log.info("vaga encerrada", {
    acao: "vaga.encerrar",
    papel: autenticado.papel,
  });
  return vaga;
}
