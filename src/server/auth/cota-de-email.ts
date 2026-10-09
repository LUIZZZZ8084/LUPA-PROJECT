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
 * São dois tetos, e cada um responde a um desses dois problemas. Os de 15
 * minutos continuam valendo por baixo deles.
 *
 * **Contra muitas origens isto não basta**, como nenhum limite por IP
 * basta. O que faz é encarecer: esgotar a cota passa a pedir cinco
 * endereços diferentes num dia, não um.
 */

const DIA = 24 * 60 * 60;

export const COTA_DE_EMAIL = {
  /**
   * Vinte por origem, somando os dois fluxos — um quinto da cota.
   *
   * Lan house e escritório põem muita gente atrás de um IP, e é por isso
   * que o número não é menor. Quem passa dele numa lan house ainda cria a
   * conta; só a confirmação de e-mail fica para o "reenviar" do perfil,
   * de outro lugar.
   */
  POR_ORIGEM: { chamadas: 20, janelaSegundos: DIA } satisfies Orcamento,
  /**
   * Cinco por conta de destino. Ninguém de boa-fé pede mais que isso num
   * dia, e é o que impede a caixa de alguém de virar alvo.
   */
  POR_CONTA: { chamadas: 5, janelaSegundos: DIA } satisfies Orcamento,
};

/**
 * Gasta um envio da cota da origem, ou recusa com `muitas_tentativas`.
 *
 * Conta **toda** tentativa, exista a conta ou não. Contando só as que
 * enviam, quem testasse e-mails seria barrado mais cedo pelos que têm conta
 * — e o bloqueio diria quem tem.
 */
export async function reservarEmailDaOrigem(origem: string): Promise<void> {
  await consumirOrcamento(`email-origem:${origem}`, COTA_DE_EMAIL.POR_ORIGEM);
}

/**
 * Gasta um envio da cota da conta de destino. Devolve `false` quando não
 * cabe, em vez de lançar.
 *
 * Não lança porque, na recuperação, quem chama não pode mudar a resposta:
 * "muitas tentativas" para um e-mail e "enviamos" para outro diria quais
 * têm conta. Quem chama decide o que mostrar.
 */
export async function cabeEmailParaConta(usuarioId: string): Promise<boolean> {
  try {
    await consumirOrcamento(
      `email-conta:${usuarioId}`,
      COTA_DE_EMAIL.POR_CONTA,
    );
    return true;
  } catch (erro) {
    if (erro instanceof AppError && erro.codigo === "muitas_tentativas") {
      return false;
    }
    throw erro;
  }
}
