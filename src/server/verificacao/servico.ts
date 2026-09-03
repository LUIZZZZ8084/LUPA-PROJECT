import "server-only";

import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { consultarCnpj, mesmaRazaoSocial } from "./cnpj";

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
   * Sem CNPJ não há o que conferir aqui. O prestador tem CPF, que não tem
   * consulta pública gratuita — é a #120, presa a provedor pago.
   */
  if (!empresa?.cnpj) {
    return {
      ok: false,
      motivo:
        "Esta conferência automática vale para empresa com CNPJ. Envie documento e selfie para verificarmos.",
    };
  }

  if (usuario.docVerificado) {
    return { ok: true, razaoSocial: empresa.razaoSocial };
  }

  const consulta = await consultarCnpj(empresa.cnpj, buscar);

  if (consulta.tipo === "indisponivel") {
    /*
     * A falha é do outro lado, e a frase diz isso. Culpar quem está na
     * tela por uma API fora do ar faz a pessoa reconferir um CNPJ que
     * está certo.
     */
    return {
      ok: false,
      motivo:
        "Não conseguimos falar com a Receita agora. Tente de novo em alguns minutos, ou envie documento e selfie.",
    };
  }

  if (consulta.tipo === "nao_encontrado") {
    return {
      ok: false,
      motivo:
        "A Receita não tem registro deste CNPJ. Confira o número — corrigi-lo é caso de suporte, porque o CNPJ não se edita depois do cadastro.",
    };
  }

  const { empresa: naReceita } = consulta;

  if (naReceita.situacao !== "ATIVA") {
    return {
      ok: false,
      motivo: `Na Receita, este CNPJ está como ${naReceita.situacao.toLowerCase()}. Só empresa ativa publica vaga aqui.`,
    };
  }

  if (!mesmaRazaoSocial(empresa.razaoSocial, naReceita.razaoSocial)) {
    /*
     * A razão social da Receita vai junto na mensagem, de propósito: é
     * dado público, e sem ela a pessoa não tem como saber o que corrigir
     * — ficaria tentando adivinhar a grafia certa.
     */
    return {
      ok: false,
      motivo: `A razão social não bate com a da Receita, que registra "${naReceita.razaoSocial}". Corrija em Editar perfil e tente de novo.`,
    };
  }

  await repositorioUsuarios().definirDocVerificado(autenticado.usuarioId, true);

  /*
   * Fica registrado o que a Receita respondeu, para o admin conferir
   * depois sem ter de repetir a consulta. Não é dado sensível: CNPJ, razão
   * social e situação são registro público.
   */
  log.info("CNPJ conferido na Receita", {
    acao: "verificacao.cnpj-automatico",
    cnpj: naReceita.cnpj,
    situacao: naReceita.situacao,
    uf: naReceita.uf,
    municipio: naReceita.municipio,
  });

  return { ok: true, razaoSocial: naReceita.razaoSocial };
}
