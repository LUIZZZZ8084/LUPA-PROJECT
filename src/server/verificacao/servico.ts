import "server-only";

import { onlyDigits } from "@/lib/format";
import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { cnpjValido } from "../validation";
import { consultarCnpj, type EmpresaNaReceita } from "./cnpj";

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
 * está ativa. Não prova que quem se cadastrou é dono dela: razão social é
 * dado público, e alguém pode digitar o CNPJ de uma empresa de verdade que
 * não é sua. Provar posse é outro problema — e não vale travar este por
 * causa dele, porque hoje não se prova nem a existência.
 *
 * Houve uma comparação com o nome digitado, e ela saiu na #130. Não fechava
 * a brecha que parecia fechar — quem copia o CNPJ de outra empresa copia o
 * nome junto, porque os dois são públicos —, e reprovava quem estava certo,
 * por acento e caixa alta. Hoje o nome **vem** da Receita em vez de ser
 * conferido contra ela: erro de digitação deixa de existir como categoria.
 *
 * Nada disto entra no caminho do cadastro. É ação de quem já tem conta, e
 * a API de terceiro fora do ar não pode impedir ninguém de criar a dela.
 */

export type ResultadoVerificacao =
  | { ok: true; razaoSocial: string }
  /** Cada motivo tem frase própria; a tela não inventa a dela. */
  | { ok: false; motivo: string };

/**
 * O núcleo da consulta, comum à empresa e ao prestador.
 *
 * Uma pergunta só, para os dois: **este CNPJ existe e está ativo?** O nome
 * que a Receita devolve vem junto na resposta, para o chamador guardar — e
 * não para ser comparado com nada. O prestador já era assim desde a #140;
 * a empresa passou a ser na #130, pelo mesmo motivo, que este arquivo
 * registra logo acima.
 *
 * Não grava nada: cada chamador decide onde persistir, porque empresa e
 * prestador guardam em tabelas diferentes.
 */
async function consultarEAvaliar(
  cnpj: string,
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

  /*
   * `null`: não comparamos com o nome digitado, preenchemos com o da
   * Receita (#130).
   *
   * A comparação existia para pegar quem digitasse o CNPJ de uma empresa
   * que não é sua. Nunca pegou — razão social é dado público, então quem
   * copia o número copia o nome junto. O que ela pegava era **quem estava
   * certo**: a Receita grava em caixa alta e sem acento, e ninguém digita
   * o próprio registro com a grafia exata. É a mesma armadilha que a #140
   * já tinha tirado do CNPJ do prestador, e que este arquivo condena por
   * escrito — verificação que reprova quem está certo ensina todo mundo a
   * ignorá-la.
   *
   * Sem comparar, o erro de digitação deixa de existir como categoria: o
   * nome passa a vir da fonte, não do teclado.
   */
  const avaliacao = await consultarEAvaliar(empresa.cnpj, buscar);

  if (!avaliacao.ok) return avaliacao;

  /*
   * O nome oficial substitui o digitado, e é ele que aparece na vaga.
   *
   * Gravado antes de marcar como verificada de propósito: verificada é o
   * estado que a tela mostra e a busca lê, então ele só passa a valer
   * depois que tudo o mais deu certo. Na ordem inversa, uma falha aqui
   * deixaria uma empresa verificada exibindo o nome que ela mesma digitou,
   * sem ninguém saber que a Receita dizia outro.
   */
  await repositorioUsuarios().salvarPerfilEmpresa(autenticado.usuarioId, {
    razaoSocial: avaliacao.razaoSocial,
    setor: empresa.setor,
    porte: empresa.porte,
    site: empresa.site,
    instagram: empresa.instagram,
    facebook: empresa.facebook,
    descricao: empresa.descricao,
  });

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
 * Salvar e conferir, num clique só, o CNPJ da empresa do prestador.
 *
 * Vale para qualquer natureza jurídica — MEI, ME, EIRELI, LTDA. O
 * primeiro desenho (#138) comparava a razão social da Receita com o nome
 * da pessoa, o que só bate para MEI: um eletricista com "Silva Elétrica
 * Ltda" era reprovado por estar certo. A #140 tirou essa comparação.
 *
 * **É divulgação, não selo de confiança.** Conferimos que o CNPJ existe e
 * está ativa, e guardamos o nome que a Receita devolveu para mostrar ao
 * lado do número — quem vai contratar lê e julga se combina com o serviço
 * anunciado. Não prova posse, e a tela não diz que prova.
 *
 * Nada disto substitui o CPF, que é o que verifica o prestador na hora de
 * ativar (#133) e continua valendo mesmo se isto falhar. Por isso salvar
 * e conferir cabem na mesma ação: ao contrário do CNPJ de empresa, fixado
 * no cadastro, este é editável a qualquer momento — cada tentativa já é a
 * chance de corrigir o número e conferir de novo.
 */
export async function definirCnpjDoPrestador(
  sessao: Autenticado | null,
  cnpjInformado: string,
  buscar?: typeof fetch,
): Promise<ResultadoVerificacao> {
  const autenticado = exigirCapacidade(sessao, "perfil:enviar_documento");

  if (autenticado.papel !== "prestador_servico") {
    throw erros.semPermissao("Este CNPJ é do perfil de prestador.");
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

  /*
   * Sem nome para comparar: o prestador não declara razão social, e usar
   * o nome dele só serviria para MEI — ver o comentário de
   * `consultarEAvaliar`.
   */
  const avaliacao = await consultarEAvaliar(cnpj, buscar);

  if (!avaliacao.ok) {
    /*
     * Ao contrário da empresa, uma falha aqui não trava nada: o CPF já
     * verificou o perfil. O número fica salvo, sem confirmação e sem
     * nome — a próxima tentativa de salvar já tenta conferir de novo.
     */
    await repo.definirCnpjPrestador(autenticado.usuarioId, cnpj, false, null);
    return {
      ok: false,
      motivo: `${avaliacao.motivo} O CNPJ foi salvo; tente conferir de novo mais tarde.`,
    };
  }

  await repo.definirCnpjPrestador(
    autenticado.usuarioId,
    cnpj,
    true,
    avaliacao.razaoSocial,
  );

  log.info("CNPJ de prestador conferido na Receita", {
    acao: "verificacao.cnpj-prestador",
    cnpj: avaliacao.naReceita.cnpj,
    situacao: avaliacao.naReceita.situacao,
    uf: avaliacao.naReceita.uf,
    municipio: avaliacao.naReceita.municipio,
  });

  return { ok: true, razaoSocial: avaliacao.razaoSocial };
}
