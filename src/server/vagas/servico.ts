import { vagaExpirada } from "@/lib/format";
import { type Autenticado, exigirCapacidade, exigirDono } from "../auth/rbac";
import { repositorioCandidaturas } from "../candidaturas";
import {
  devolverCobranca,
  direitoDePublicar,
  gastarParaPublicar,
} from "../carteiras/servico";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { idDaEmpresaDoUsuario } from "./dono";
import { repositorioVagas } from "./index";
import type { DadosNovaVaga, Vaga } from "./tipos";

/**
 * Regras de vaga no painel da empresa.
 *
 * Cada operação de escrita faz duas perguntas, sempre nesta ordem: o papel
 * pode fazer isto (`exigirCapacidade`) e esta vaga é desta empresa
 * (`exigirDono`). Só a primeira deixaria qualquer empresa autenticada
 * alcançar a vaga de outra trocando o id na URL.
 */

function idDaEmpresa(sessao: Autenticado): string {
  return idDaEmpresaDoUsuario(sessao.usuarioId);
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
   * Só o prestador e o admin chegam aqui sem perfil de contratante.
   *
   * A conta de empresa ganha o dela em `cadastrar()`, na mesma passada que
   * cria o usuário. Consultar o banco para os três papéis seria uma
   * consulta a mais em toda publicação de vaga, para responder uma pergunta
   * cuja resposta já se conhece — e faria este serviço depender do
   * repositório de usuários num caminho onde ele não precisa. O admin entra
   * pelo mesmo motivo do prestador (#499): a conta dele é criada por
   * script, sem passar pelo cadastro de empresa.
   */
  if (sessao.papel !== "prestador_servico" && sessao.papel !== "admin") return;

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
 * Publicar custa um crédito, ou nada se o plano ativo ainda tem lugar, ou
 * se é a primeira vaga grátis (#172, #489).
 *
 * **A cobrança vem antes da gravação**, e não depois. Na ordem inversa, a
 * vaga entraria no ar e um erro na carteira a deixaria publicada de graça
 * — e "de graça por acidente" é o tipo de coisa que ninguém descobre até
 * conferir a receita no fim do mês. Se a gravação falhar depois de
 * cobrado, o que foi gasto volta: perder um crédito, ou a primeira vaga
 * grátis, por uma falha nossa é pior do que a conta não fechar por um
 * instante.
 */
export async function publicarVaga(
  sessao: Autenticado | null,
  dados: Omit<DadosNovaVaga, "empresaId" | "cidade"> & { cidade: string },
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:publicar");

  await garantirPerfilDeContratante(autenticado);

  const cobranca = await gastarParaPublicar(autenticado.usuarioId);
  if (!cobranca) {
    throw erros.validacao(
      [{ campo: "creditos", mensagem: "Você não tem vagas para publicar." }],
      await motivoDaRecusa(autenticado.usuarioId),
    );
  }

  let vaga: Vaga;
  try {
    vaga = await repositorioVagas().criar({
      ...dados,
      empresaId: idDaEmpresa(autenticado),
      publicadaPor: autenticado.usuarioId,
    });
  } catch (e) {
    await devolverCobranca(autenticado.usuarioId, cobranca);
    throw e;
  }

  log.info("vaga publicada", {
    acao: "vaga.publicar",
    papel: autenticado.papel,
  });
  return vaga;
}

/**
 * O que dizer a quem foi recusado, a partir do porquê.
 *
 * Plano cheio e sem plano são recusas diferentes, e a saída de cada uma
 * também: quem está no limite do plano precisa saber que **o plano
 * funciona**, e que o que falta é lugar. Dizer "assine um plano" a quem
 * já assinou é a mensagem que faz a pessoa concluir que o app não sabe
 * que ela existe.
 */
async function motivoDaRecusa(usuarioId: string): Promise<string> {
  const direito = await direitoDePublicar(usuarioId);

  if (direito.mensalAtivo && direito.limiteNoAr !== null) {
    return (
      `O seu plano deixa ${direito.limiteNoAr} vagas no ar ao mesmo tempo, ` +
      "e já são todas. Encerre uma vaga, compre uma avulsa ou mude de plano."
    );
  }

  return "Para publicar, compre uma vaga avulsa ou assine um plano.";
}

/**
 * Corrigir o texto da vaga publicada (#544).
 *
 * A edição saiu na #173 por dois motivos, e os dois continuam valendo — o
 * que mudou é que eles se resolvem travando campos, e não a edição inteira:
 *
 * - **Reescrever uma vaga paga como se fosse outra.** Cargo, categoria,
 *   cidade, contrato, modalidade, PCD e perguntas não mudam: a vaga de
 *   motorista em Sorriso continua sendo de motorista em Sorriso, e virar
 *   outra vaga custa outra vaga. O prazo de 30 dias também não muda.
 * - **Quem se candidatou descobrir na entrevista que a vaga mudou.** Com
 *   candidatura recebida, o salário não diminui — nem o piso, nem o teto.
 *   Subir, corrigir o endereço ou detalhar a descrição só ajuda quem já se
 *   candidatou.
 *
 * O que sobrou da #173 é a revisão antes de publicar, que continua: ela
 * pega o erro antes, e a edição é para o que passou mesmo assim.
 */
export async function editarVaga(
  sessao: Autenticado | null,
  dados: {
    id: string;
    descricao: string;
    bairro?: string | null;
    endereco: string;
    habilidades?: string[];
    salarioMin?: number | null;
    salarioMax?: number | null;
  },
): Promise<Vaga> {
  const autenticado = exigirCapacidade(sessao, "vaga:editar_propria");
  const atual = await vagaDaEmpresa(autenticado, dados.id);

  if (atual.status !== "aberta" || vagaExpirada(atual.expiraEm)) {
    throw erros.conflito(
      "Esta vaga não está no ar. Para anunciar de novo, publique outra parecida.",
    );
  }

  const salarioMin = dados.salarioMin ?? null;
  const salarioMax = dados.salarioMax ?? null;
  const candidaturas = await repositorioCandidaturas().porVaga(atual.id);
  const diminuiu = (novo: number | null, antigo: number | null) =>
    antigo !== null && (novo === null || novo < antigo);
  if (
    candidaturas.length > 0 &&
    (diminuiu(salarioMin, atual.salarioMin) ||
      diminuiu(salarioMax, atual.salarioMax))
  ) {
    throw erros.validacao(
      [
        {
          campo: "salarioMin",
          mensagem:
            "Já há candidaturas: o salário pode subir, mas não diminuir.",
        },
      ],
      "Quem já se candidatou viu o salário anunciado. Ele pode subir, mas não diminuir.",
    );
  }

  const vaga = await repositorioVagas().atualizar(atual.id, {
    descricao: dados.descricao,
    bairro: dados.bairro ?? null,
    endereco: dados.endereco,
    habilidades: dados.habilidades ?? [],
    salarioMin,
    salarioMax,
  });
  log.info("vaga editada", {
    acao: "vaga.editar",
    papel: autenticado.papel,
    comCandidaturas: candidaturas.length > 0,
  });
  return vaga;
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

  const cobranca = await gastarParaPublicar(autenticado.usuarioId);
  if (!cobranca) {
    throw erros.validacao(
      [{ campo: "creditos", mensagem: "Você não tem vagas para publicar." }],
      `Reativar conta como publicar. ${await motivoDaRecusa(autenticado.usuarioId)}`,
    );
  }

  let vaga: Vaga;
  try {
    vaga = await repositorioVagas().reativar(id);
  } catch (e) {
    await devolverCobranca(autenticado.usuarioId, cobranca);
    throw e;
  }

  log.info("vaga reativada", {
    acao: "vaga.reativar",
    papel: autenticado.papel,
  });
  return vaga;
}
