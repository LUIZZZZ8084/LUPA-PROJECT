import { empresaDoPainel } from "@/lib/data";
import { vagaExpirada } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  type Autenticado,
  exigirCapacidade,
  exigirDono,
  pode,
} from "../auth/rbac";
import { devolverCredito, gastarParaPublicar } from "../carteiras/servico";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
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

/**
 * Quem contrata sem ter aberto empresa ganha o perfil de contratante na
 * primeira vaga que publica (#129).
 *
 * `job_listings` faz **inner join** com `perfis_empresa`: sem essa linha, a
 * vaga é gravada e some da busca — o pior desfecho possível, porque a
 * pessoa vê "vaga publicada", não se acha em `/vagas` e conclui que o app
 * engoliu o anúncio dela. É a mesma família do padrão de cidade que
 * escondia vaga de quem tinha acabado de publicar.
 *
 * A razão social é o nome da pessoa, e o CNPJ fica nulo — exatamente o
 * formato do produtor rural da #139. O CPF **não** vem para cá: esta tabela
 * é lida pela chave anônima, e o documento continua em `usuarios`. Quem
 * olha a vaga sabe que é pessoa física porque não há CNPJ, não porque
 * mostramos documento nenhum.
 *
 * Criar aqui, e não numa tela à parte, é decisão de atrito: uma tela a mais
 * entre a pessoa e a vaga dela seria mais um lugar para desistir, e não
 * perguntaria nada que a sessão já não responda.
 */
async function garantirPerfilDeContratante(sessao: Autenticado): Promise<void> {
  /*
   * Só o prestador chega aqui sem perfil de contratante.
   *
   * A conta de empresa ganha o dela em `cadastrar()`, na mesma passada que
   * cria o usuário. Consultar o banco para os dois papéis seria uma
   * consulta a mais em toda publicação de vaga, para responder uma pergunta
   * cuja resposta já se conhece — e faria este serviço depender do
   * repositório de usuários num caminho onde ele não precisa.
   */
  if (sessao.papel !== "prestador_servico") return;

  const repo = repositorioUsuarios();
  if (await repo.perfilEmpresa(sessao.usuarioId)) return;

  const usuario = await repo.porId(sessao.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  await repo.criarPerfilEmpresa({
    usuarioId: sessao.usuarioId,
    razaoSocial: usuario.nomeCompleto,
    cnpj: null,
    setor: null,
    porte: null,
    site: null,
    instagram: null,
    facebook: null,
    descricao: null,
    logoUrl: null,
    plano: "trial",
  });
}

/**
 * Publicar custa um crédito, ou nada se o plano mensal estiver ativo
 * (#172).
 *
 * **A cobrança vem antes da gravação**, e não depois. Na ordem inversa, a
 * vaga entraria no ar e um erro na carteira a deixaria publicada de graça
 * — e "de graça por acidente" é o tipo de coisa que ninguém descobre até
 * conferir a receita no fim do mês. Se a gravação falhar depois de
 * cobrado, o crédito volta: perder um crédito por uma falha nossa é pior
 * do que a conta não fechar por um instante.
 */
export async function publicarVaga(
  sessao: Autenticado | null,
  dados: Omit<DadosNovaVaga, "empresaId" | "cidade"> & { cidade: string },
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:publicar");

  await garantirPerfilDeContratante(autenticado);

  if (!(await gastarParaPublicar(autenticado.usuarioId))) {
    throw erros.validacao(
      [{ campo: "creditos", mensagem: "Você não tem créditos de vaga." }],
      "Para publicar, compre um crédito de vaga ou assine o plano mensal.",
    );
  }

  let vaga: Vaga;
  try {
    vaga = await repositorioVagas().criar({
      ...dados,
      empresaId: idDaEmpresa(autenticado),
    });
  } catch (e) {
    await devolverCredito(autenticado.usuarioId);
    throw e;
  }

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

/**
 * Reativa vaga que passou dos 30 dias — nunca a que foi encerrada à mão.
 *
 * "Encerrar" é decisão do dono; "expirar" é só o tempo passando. Reativar
 * desfaz a segunda, não a primeira: vaga com `status: "fechada"` continua
 * fechada até que exista algum jeito de reabrir isso, que hoje não existe.
 *
 * **Reativar custa um crédito, como publicar** — decisão do Luiz em
 * 09/09/2026 (#172), revertendo o "gratuito e sem limite de vezes" com
 * que a #157 nasceu. Aquela decisão foi tomada quando publicar não
 * custava nada; com crédito por vaga, reativar de graça seria o caminho
 * óbvio para não pagar: publica uma vaga e a renova para sempre. Vaga
 * fantasma paga uma vez.
 *
 * O que continua valendo da #157: reativar não é "publicar de novo" no
 * sentido de estado — só estende `expira_em`, sem mexer em `status`, e
 * não serve para vaga que o dono encerrou.
 */
export async function reativarVaga(
  sessao: Autenticado | null,
  id: string,
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:reativar_propria");
  const atual = await vagaDaEmpresa(autenticado, id);

  if (atual.status !== "aberta" || !vagaExpirada(atual.expiraEm)) {
    throw erros.conflito(
      "Esta vaga não está expirada — não há o que reativar.",
    );
  }

  if (!(await gastarParaPublicar(autenticado.usuarioId))) {
    throw erros.validacao(
      [{ campo: "creditos", mensagem: "Você não tem créditos de vaga." }],
      "Reativar uma vaga custa um crédito, como publicar. Compre um crédito ou assine o plano mensal.",
    );
  }

  let vaga: Vaga;
  try {
    vaga = await repositorioVagas().reativar(id);
  } catch (e) {
    await devolverCredito(autenticado.usuarioId);
    throw e;
  }

  log.info("vaga reativada", {
    acao: "vaga.reativar",
    papel: autenticado.papel,
  });
  return vaga;
}
