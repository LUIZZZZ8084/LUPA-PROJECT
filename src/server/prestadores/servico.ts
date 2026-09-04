import "server-only";

import { SERVICE_CATEGORIES } from "@/lib/constants";
import { onlyDigits } from "@/lib/format";
import { type Autenticado, exigirCapacidade, type Papel } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { cpfValido } from "../validation";

/**
 * Ativar o lado prestador de uma conta que já existe.
 *
 * O card "Oferecer serviço" da home mandava para `/cadastro?tipo=
 * prestador_servico` — a tela de criar conta, com e-mail e senha do zero.
 * Ninguém vê aquela home sem sessão: o app é fechado por login. Pedir
 * cadastro a quem já se cadastrou é pedir para a pessoa manter duas contas
 * e não achar nenhuma das duas depois.
 *
 * **A troca é de mão única, e quem chama precisa ter avisado.** O papel é a
 * chave do RBAC inteiro: virar `prestador_servico` tira `candidatura:criar`
 * — a pessoa deixa de poder se candidatar a vagas. Decisão do Luiz em
 * 02/09/2026, com o aviso na tela como condição. O histórico do que ela já
 * se candidatou continua visível (`candidatura:ver_propria` vale para os
 * dois papéis); o que acaba é criar candidatura nova.
 *
 * Voltar atrás é caso de suporte, como a cidade e o CNPJ — pelo mesmo
 * motivo: é troca de identidade dentro da plataforma, não correção de
 * campo.
 */

export interface DadosAtivacaoPrestador {
  /**
   * Só chega vazio de quem se cadastrou antes de o CPF virar obrigatório
   * — para quem já tem um gravado, o formulário nem mostra o campo.
   */
  cpf?: string;
  categoriaId: number;
  descricao: string;
  precoInicial?: number | null;
}

/**
 * Quem já tem foto pode ativar; quem não tem, não.
 *
 * A foto é o rosto do anúncio: quem contrata um eletricista para entrar em
 * casa decide olhando para ela. Mas o modo demonstração não tem Storage —
 * `enviarFoto` recusa por lá —, e exigir foto onde não dá para enviar
 * nenhuma trancaria o fluxo inteiro para quem está só conhecendo o produto,
 * e para a suíte e2e, que roda sempre em demonstração.
 *
 * Por isso a exigência acompanha a existência do Storage, e não é um
 * `required` cego no formulário.
 */
export function exigeFotoDePerfil(temArmazenamento: boolean): boolean {
  return temArmazenamento;
}

export async function virarPrestador(
  sessao: Autenticado | null,
  dados: DadosAtivacaoPrestador,
  opcoes: { temArmazenamento: boolean },
): Promise<{ papel: Papel }> {
  const autenticado = exigirCapacidade(sessao, "prestador:ativar");
  const repo = repositorioUsuarios();

  const usuario = await repo.porId(autenticado.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  if (exigeFotoDePerfil(opcoes.temArmazenamento) && !usuario.avatarUrl) {
    throw erros.validacao(
      [{ campo: "foto", mensagem: "Envie uma foto de perfil." }],
      "Quem contrata decide olhando para o seu rosto. Envie uma foto de perfil antes de oferecer serviço.",
    );
  }

  /*
   * Quem se cadastrou depois do CPF virar obrigatório já tem um gravado
   * em `usuarios` — pedir de novo aqui seria digitar duas vezes o mesmo
   * documento, e a checagem de unicidade abaixo rejeitaria o próprio CPF
   * da pessoa como "já em uso por outro perfil", porque já está, por ela
   * mesma. Só quem se cadastrou antes disso chega aqui sem CPF.
   */
  let cpf = usuario.cpf;

  if (!cpf) {
    if (!dados.cpf) {
      throw erros.validacao([{ campo: "cpf", mensagem: "Informe seu CPF." }]);
    }

    cpf = onlyDigits(dados.cpf);
    if (!cpfValido(cpf)) {
      throw erros.validacao([{ campo: "cpf", mensagem: "CPF inválido." }]);
    }

    /*
     * Um CPF, um prestador — a mesma regra do CNPJ da empresa. O índice
     * único no banco é quem garante de verdade contra duas ativações
     * simultâneas; esta checagem existe para dar mensagem decente antes
     * de gravar, não no lugar dela.
     */
    if (await repo.cpfEmUso(cpf)) {
      throw erros.validacao([
        {
          campo: "cpf",
          mensagem: "Este CPF já está em uso por outro perfil.",
        },
      ]);
    }
  }

  if (!SERVICE_CATEGORIES.some((c) => c.id === dados.categoriaId)) {
    throw erros.validacao([
      { campo: "categoriaId", mensagem: "Escolha uma categoria." },
    ]);
  }

  await repo.criarPerfilPrestador({
    usuarioId: autenticado.usuarioId,
    categoriaId: dados.categoriaId,
    descricao: dados.descricao,
    precoInicial: dados.precoInicial ?? null,
    anosExperiencia: null,
    /*
     * Nasce atendendo o próprio bairro, quando ele existe. Perguntar a
     * área de atendimento na ativação seria mais um campo entre a pessoa e
     * o primeiro contato; ela ajusta depois em `/perfil/editar`, que já
     * tem o campo.
     */
    bairrosAtendidos: usuario.bairro ? [usuario.bairro] : [],
    instagram: null,
    facebook: null,
    // MEI é declarado depois, em Editar perfil.
    cnpj: null,
    cnpjVerificado: false,
    razaoSocial: null,
  });

  /*
   * O documento vai para `usuarios`, não para `perfis_prestador`: aquela
   * tabela é lida pela chave anônima, que roda no navegador. CNPJ pode ser
   * público porque é registro público; CPF não é.
   *
   * Só grava quem chegou sem CPF — quem já tinha um do cadastro não tem o
   * que regravar.
   */
  if (!usuario.cpf) await repo.definirCpf(autenticado.usuarioId, cpf);
  await repo.atualizarPapel(autenticado.usuarioId, "prestador_servico");

  /*
   * CPF válido e único é a própria verificação, sem fila e sem foto.
   *
   * A tela chegou a prometer "envie documento e selfie" — e esse envio
   * nunca existiu no app: não há campo de arquivo para isso em
   * `perfil/editar`, `Especie` não tem `"documento"` nem `"selfie"`, e
   * nada além do seed escreve em `pedidos_verificacao`. Fora da
   * demonstração, todo prestador ficava preso sem saída, atrás de uma
   * promessa que a tela não cumpria.
   *
   * A troca: já que virar prestador exige um CPF que passou por dígito
   * verificador e por unicidade — a mesma dupla checagem que a #128 já
   * usa para CNPJ —, esse CPF passa a ser o que libera a busca. É a
   * mesma família de garantia da verificação automática de CNPJ, com o
   * mesmo limite: prova que o documento existe e é único, não que é de
   * quem digitou. Decisão do Luiz em 03/09/2026, depois de confirmar que
   * a alternativa — documento e selfie — nunca funcionou de verdade.
   */
  await repo.definirDocVerificado(autenticado.usuarioId, true);

  log.info("conta virou prestador", {
    acao: "prestador.ativar",
    papel: autenticado.papel,
  });

  return { papel: "prestador_servico" };
}
