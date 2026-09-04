import "server-only";

import { onlyDigits } from "@/lib/format";
import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { cnpjValido } from "../validation";
import { consultarCnpj, type EmpresaNaReceita, mesmaRazaoSocial } from "./cnpj";

/**
 * Conferir o CNPJ da empresa na Receita, sem fila.
 *
 * O que se ganha: hoje o CNPJ passa por dígito verificador, e isso deixa
 * entrar qualquer número bem formado. Consultando a Receita, empresa
 * inventada não passa — que é o risco concreto por trás do CNPJ
 * obrigatório: vaga falsa em plataforma de emprego costuma virar golpe de
 * taxa de cadastro cobrada de quem está desempregado.
 *
 * **O que isto prova, e o que não prova.** Prova que a empresa existe e
 * está ativa, e que a razão social informada é a dela. Não prova que quem
 * se cadastrou é dono dela: razão social é dado público, e alguém pode
 * digitar o CNPJ de uma empresa de verdade que não é sua. Provar posse é
 * outro problema — e não vale travar este por causa dele, porque hoje não
 * se prova nem a existência.
 *
 * Nada disto entra no caminho do cadastro. É ação de quem já tem conta, e
 * a API de terceiro fora do ar não pode impedir ninguém de criar a dela.
 */

export type ResultadoVerificacao =
  | { ok: true; razaoSocial: string }
  /** Cada motivo tem frase própria; a tela não inventa a dela. */
  | { ok: false; motivo: string };

/**
 * O núcleo da consulta, comum a empresa e a prestador MEI.
 *
 * Recebe o CNPJ e o nome contra o qual comparar a razão social — para
 * empresa é a razão social declarada; para o MEI é o próprio nome
 * completo, porque na Receita a razão social de um MEI é o nome da
 * pessoa. Não grava nada: cada chamador decide onde persistir o
 * resultado, porque empresa e prestador guardam em tabelas diferentes.
 */
async function consultarEAvaliar(
  cnpj: string,
  nomeParaComparar: string,
  buscar?: typeof fetch,
): Promise<
  | { ok: true; razaoSocial: string; naReceita: EmpresaNaReceita }
  | { ok: false; motivo: string }
> {
  const consulta = await consultarCnpj(cnpj, buscar);

  if (consulta.tipo === "indisponivel") {
    /*
     * A falha é do outro lado, e a frase diz isso. Culpar quem está na
     * tela por uma API fora do ar faz a pessoa reconferir um CNPJ que
     * está certo.
     */
    return {
      ok: false,
      motivo:
        "Não conseguimos falar com a Receita agora. Tente de novo em alguns minutos.",
    };
  }

  if (consulta.tipo === "nao_encontrado") {
    return {
      ok: false,
      motivo: "A Receita não tem registro deste CNPJ. Confira o número.",
    };
  }

  const { empresa: naReceita } = consulta;

  if (naReceita.situacao !== "ATIVA") {
    return {
      ok: false,
      motivo: `Na Receita, este CNPJ está como ${naReceita.situacao.toLowerCase()}.`,
    };
  }

  if (!mesmaRazaoSocial(nomeParaComparar, naReceita.razaoSocial)) {
    /*
     * A razão social da Receita vai junto na mensagem, de propósito: é
     * dado público, e sem ela a pessoa não tem como saber o que corrigir
     * — ficaria tentando adivinhar a grafia certa.
     */
    return {
      ok: false,
      motivo: `O nome não bate com o da Receita, que registra "${naReceita.razaoSocial}".`,
    };
  }

  return { ok: true, razaoSocial: naReceita.razaoSocial, naReceita };
}

export async function verificarCnpjAutomatico(
  sessao: Autenticado | null,
  buscar?: typeof fetch,
): Promise<ResultadoVerificacao> {
  /*
   * `perfil:enviar_documento` e não uma capacidade nova: a pergunta é a
   * mesma — "esta pessoa pode provar quem ela é?" —, e criar capacidade
   * separada para o mesmo ato espalharia a regra por dois lugares.
   */
  const autenticado = exigirCapacidade(sessao, "perfil:enviar_documento");

  const [usuario, empresa] = await Promise.all([
    repositorioUsuarios().porId(autenticado.usuarioId),
    repositorioUsuarios().perfilEmpresa(autenticado.usuarioId),
  ]);

  if (!usuario) throw erros.naoEncontrado("Usuário");

  /*
   * Sem CNPJ não há o que conferir aqui — é o caso de quem se cadastrou
   * com CPF em vez de CNPJ (#138), já verificado na hora do cadastro.
   */
  if (!empresa?.cnpj) {
    return {
      ok: false,
      motivo: "Esta conta não tem CNPJ cadastrado.",
    };
  }

  if (usuario.docVerificado) {
    return { ok: true, razaoSocial: empresa.razaoSocial };
  }

  const avaliacao = await consultarEAvaliar(
    empresa.cnpj,
    empresa.razaoSocial,
    buscar,
  );

  if (!avaliacao.ok) return avaliacao;

  await repositorioUsuarios().definirDocVerificado(autenticado.usuarioId, true);

  /*
   * Fica registrado o que a Receita respondeu, para o admin conferir
   * depois sem ter de repetir a consulta. Não é dado sensível: CNPJ, razão
   * social e situação são registro público.
   */
  log.info("CNPJ conferido na Receita", {
    acao: "verificacao.cnpj-automatico",
    cnpj: avaliacao.naReceita.cnpj,
    situacao: avaliacao.naReceita.situacao,
    uf: avaliacao.naReceita.uf,
    municipio: avaliacao.naReceita.municipio,
  });

  return { ok: true, razaoSocial: avaliacao.razaoSocial };
}

/**
 * Salvar e conferir, num clique só, o CNPJ de MEI do prestador.
 *
 * Selo adicional, não substituto: o CPF em `usuarios` já verifica o
 * prestador na hora de ativar (#133), e continua valendo mesmo se isto
 * falhar. O que muda ao dar certo é só um selo a mais no perfil público,
 * "MEI confirmado" — por isso salvar e confirmar cabem na mesma ação, ao
 * contrário do CNPJ de empresa: aquele é fixado no cadastro e só pode ser
 * *confirmado* depois, porque o número em si não muda mais. Este é
 * editável a qualquer momento em `/perfil/editar`, então cada tentativa
 * já é a chance de corrigir o número e confirmar de novo.
 *
 * A razão social comparada é o próprio nome completo da pessoa: na
 * Receita, o MEI é registrado no nome de quem abriu — não existe "razão
 * social da empresa" separada dele.
 */
export async function definirCnpjDoPrestador(
  sessao: Autenticado | null,
  cnpjInformado: string,
  buscar?: typeof fetch,
): Promise<ResultadoVerificacao> {
  const autenticado = exigirCapacidade(sessao, "perfil:enviar_documento");

  if (autenticado.papel !== "prestador_servico") {
    throw erros.semPermissao("CNPJ de MEI é só para prestador de serviço.");
  }

  const cnpj = onlyDigits(cnpjInformado);
  if (!cnpjValido(cnpj)) {
    return { ok: false, motivo: "CNPJ inválido." };
  }

  const repo = repositorioUsuarios();

  if (await repo.cnpjEmUso(cnpj, autenticado.usuarioId)) {
    return {
      ok: false,
      motivo: "Este CNPJ já está em uso por outro perfil.",
    };
  }

  const usuario = await repo.porId(autenticado.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  const avaliacao = await consultarEAvaliar(cnpj, usuario.nomeCompleto, buscar);

  if (!avaliacao.ok) {
    /*
     * Ao contrário da empresa, uma falha aqui não trava nada: o CPF já
     * verificou o perfil. O número fica salvo, sem o selo — a próxima
     * tentativa de salvar já tenta confirmar de novo.
     */
    await repo.definirCnpjPrestador(autenticado.usuarioId, cnpj, false);
    return {
      ok: false,
      motivo: `${avaliacao.motivo} O CNPJ foi salvo; tente confirmar de novo mais tarde.`,
    };
  }

  await repo.definirCnpjPrestador(autenticado.usuarioId, cnpj, true);

  log.info("CNPJ de MEI conferido na Receita", {
    acao: "verificacao.cnpj-prestador",
    cnpj: avaliacao.naReceita.cnpj,
    situacao: avaliacao.naReceita.situacao,
    uf: avaliacao.naReceita.uf,
    municipio: avaliacao.naReceita.municipio,
  });

  return { ok: true, razaoSocial: avaliacao.razaoSocial };
}
