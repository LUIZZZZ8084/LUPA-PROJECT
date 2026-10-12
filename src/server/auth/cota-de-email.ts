import "server-only";

import { AppError } from "../errors";
import type { Orcamento } from "../limites";
import { consumirOrcamento } from "./rate-limit";

/**
 * A cota diária de e-mail, dividida para ninguém gastar a de todo mundo
 * (#407).
 *
 * O plano grátis do Resend manda 100 e-mails por dia, e é uma cota só para
 * o app inteiro. A recuperação de senha e a confirmação de e-mail tinham
 * limite só de 5 em 15 minutos por origem — até 480 envios por dia do
 * mesmo IP. Uma origem sozinha esgotava a cota, e no resto do dia ninguém
 * recuperava a senha. E a mesma pessoa podia receber dezenas de "redefinir
 * sua senha" que não pediu.
 *
 * São três tetos, e cada um responde a um desses problemas. Os de 15
 * minutos continuam valendo por baixo deles.
 *
 * O bloqueio dura até a janela de um dia, contada do primeiro pedido,
 * vencer: insistir não o prolonga, porque só `consumirOrcamento` decide
 * aqui, e a janela vencida recomeça a contagem. Não se confere o bloqueio
 * antes (`conferirLimite`, como no login): ele lê `bloqueado_ate`, que
 * cada pedido acima do teto empurra para frente.
 *
 * **Contra muitas origens isto não basta**, como nenhum limite por IP
 * basta. O que faz é encarecer.
 */

const DIA = 24 * 60 * 60;

export type FluxoDeEmail = "recuperacao" | "verificacao";

export const COTA_DE_EMAIL = {
  /**
   * Por origem, **e por fluxo** (#411).
   *
   * Somar os dois fluxos punha o cadastro e a recuperação no mesmo balde:
   * um IP de operadora móvel, atrás do qual muita gente se cadastra num dia
   * de divulgação, gastava a cota com confirmações, e a recuperação passava
   * a responder "muitas tentativas" a quem nunca tinha pedido nada.
   * Separados, cadastro movimentado não tira de ninguém a senha.
   *
   * A confirmação tem mais porque sai em todo cadastro; a recuperação é
   * rara, e é a que se usa para mandar e-mail a quem não pediu. Os números
   * acompanham o plano do Resend: com o grátis, uma origem gasta no máximo
   * 30 dos 100 do dia.
   */
  POR_ORIGEM: {
    verificacao: { chamadas: 20, janelaSegundos: DIA },
    recuperacao: { chamadas: 10, janelaSegundos: DIA },
  } satisfies Record<FluxoDeEmail, Orcamento>,
  /**
   * Por conta de destino, vindo de uma origem (#411).
   *
   * Era só por conta, e a conta é de quem recebe, não de quem pede: cinco
   * pedidos com o endereço de alguém, de qualquer lugar, deixavam essa
   * pessoa um dia sem recuperar a senha. Com a origem na chave, quem pede
   * por outra pessoa gasta só a parte dele.
   */
  POR_CONTA_E_ORIGEM: { chamadas: 3, janelaSegundos: DIA } satisfies Orcamento,
  /**
   * Por conta de destino, somando as origens: o teto da caixa. Ninguém de
   * boa-fé pede mais que isso num dia, e é o que impede a caixa de alguém
   * de virar alvo. Esgotá-lo de propósito passa a pedir quatro origens.
   */
  POR_CONTA: { chamadas: 10, janelaSegundos: DIA } satisfies Orcamento,
};

/**
 * Gasta um envio da cota da origem para o fluxo, ou recusa com
 * `muitas_tentativas`.
 *
 * Conta **toda** tentativa, exista a conta ou não. Contando só as que
 * enviam, quem testasse e-mails seria barrado mais cedo pelos que têm conta
 * — e o bloqueio diria quem tem.
 */
export async function reservarEmailDaOrigem(
  fluxo: FluxoDeEmail,
  origem: string,
): Promise<void> {
  await consumirOrcamento(
    `email-origem:${fluxo}:${origem}`,
    COTA_DE_EMAIL.POR_ORIGEM[fluxo],
  );
}

/**
 * Gasta um envio da cota da conta de destino. Devolve `false` quando não
 * cabe, em vez de lançar.
 *
 * Não lança porque, na recuperação, quem chama não pode mudar a resposta:
 * "muitas tentativas" para um e-mail e "enviamos" para outro diria quais
 * têm conta. Quem chama decide o que mostrar.
 *
 * O par conta e origem vem antes do total: o que passa do par não chega a
 * gastar o total, então quem pede por outra pessoa de um lugar só não
 * esgota a caixa dela.
 */
export async function cabeEmailParaConta(
  usuarioId: string,
  origem: string,
): Promise<boolean> {
  return (
    (await cabe(
      `email-conta:${usuarioId}:${origem}`,
      COTA_DE_EMAIL.POR_CONTA_E_ORIGEM,
    )) && (await cabe(`email-conta:${usuarioId}`, COTA_DE_EMAIL.POR_CONTA))
  );
}

async function cabe(chave: string, orcamento: Orcamento): Promise<boolean> {
  try {
    await consumirOrcamento(chave, orcamento);
    return true;
  } catch (erro) {
    if (erro instanceof AppError && erro.codigo === "muitas_tentativas") {
      return false;
    }
    throw erro;
  }
}
