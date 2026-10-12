import "server-only";

import { apagarArquivosDaConta } from "../arquivos/servico";
import { conferirSenha } from "../auth/password";
import { conferirLimite, reservarTentativa } from "../auth/rate-limit";
import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioPagamentos } from "../pagamentos";
import { TIPOS_RECORRENTES } from "../pagamentos/planos";
import { cancelarRenovacao } from "../pagamentos/servico";
import { repositorioUsuarios } from "../repositories";

/**
 * Exclui a conta de quem pede (#423). LGPD, art. 18, VI.
 *
 * A ordem é a que deixa a pior falha recuperável:
 *
 * 1. **Senha.** Excluir é irreversível, e a sessão sozinha pode ser de um
 *    cookie roubado ou de um aparelho esquecido aberto. O limite é o do
 *    login, por conta: reservado antes do Argon2, para a rajada não passar.
 * 2. **Assinatura.** Cancelada no Mercado Pago antes de tudo. Se o
 *    cancelamento falhar, nada é excluído: excluir primeiro deixaria a
 *    cobrança mensal correndo para alguém que não tem mais conta para
 *    cancelá-la — a mesma regra da devolução, que cancela antes de mover
 *    o dinheiro.
 * 3. **Banco.** Uma função só, numa transação.
 * 4. **Arquivos.** Por último, como em toda remoção deste app: o banco já
 *    não aponta para eles. Falha aqui não volta atrás — a conta já foi —,
 *    e vai ao Sentry, porque arquivo que sobra é dado pessoal sem dono.
 *
 * `cancelar` é parâmetro só para o teste da falha do Mercado Pago.
 */
export async function excluirConta(
  sessao: Autenticado | null,
  senha: string,
  opcoes: { cancelar?: typeof cancelarRenovacao } = {},
): Promise<void> {
  const quem = exigirCapacidade(sessao, "conta:excluir");

  const chave = `excluir:${quem.usuarioId}`;
  await conferirLimite(chave);
  await reservarTentativa(chave);

  const repo = repositorioUsuarios();
  const usuario = await repo.porId(quem.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Conta");

  if (!(await conferirSenha(senha, usuario.senhaHash))) {
    throw erros.validacao([{ campo: "senha", mensagem: "Senha incorreta." }]);
  }

  const cancelar = opcoes.cancelar ?? cancelarRenovacao;
  const pagamentos = repositorioPagamentos();
  for (const tipo of TIPOS_RECORRENTES) {
    if (!(await pagamentos.assinaturaViva(quem.usuarioId, tipo))) continue;
    const cancelada = await cancelar(quem, tipo);
    if (!cancelada.ok) {
      log.warn("exclusão de conta parada: assinatura não cancelada", {
        acao: "conta.excluir",
        tipo,
      });
      throw erros.conflito(
        "Não conseguimos cancelar sua assinatura agora, e sem isso a conta não é excluída — a cobrança continuaria. Tente de novo em alguns minutos.",
        "assinatura não cancelada",
      );
    }
  }

  await repo.excluirConta(quem.usuarioId);

  if (!(await apagarArquivosDaConta(quem.usuarioId))) {
    log.erro(erros.indisponivel("arquivos de conta excluída não apagados"), {
      acao: "conta.excluir",
      usuarioId: quem.usuarioId,
    });
  }

  log.info("conta excluída pelo dono", {
    acao: "conta.excluir",
    papel: quem.papel,
  });
}
