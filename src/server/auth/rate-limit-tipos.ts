/**
 * O contrato do limite de tentativas.
 *
 * Duas implementações e um contrato, como o resto do servidor: memória
 * para a demonstração e para o teste, Postgres para produção. O que os
 * testes exercitam é a mesma regra que roda em produção.
 */

import type { Orcamento } from "../limites";

export interface RepositorioLimite {
  /** Até quando a chave está bloqueada, ou `null` se não está. */
  bloqueadoAte(chave: string): Promise<Date | null>;

  /** Soma uma falha e bloqueia ao atingir o teto. */
  registrarFalha(chave: string): Promise<void>;

  /** Zera o contador. */
  registrarSucesso(chave: string): Promise<void>;

  /**
   * Soma um uso contra um orçamento e devolve até quando a chave ficou
   * bloqueada, ou `null` se ainda cabe (#202).
   *
   * É parente de `registrarFalha`, mas responde outra pergunta, e por isso
   * é outro método: lá se contém **adivinhação de senha**, e o orçamento é
   * fixo; aqui se contém **volume de chamada**, e cada ação tem o seu.
   * Conta toda chamada, não só a que deu errado — numa ação de escrita, a
   * que deu certo é justamente a que custou.
   */
  registrarUso(chave: string, orcamento: Orcamento): Promise<Date | null>;
}

/**
 * Cinco tentativas em quinze minutos, bloqueio de quinze.
 *
 * Números escolhidos para conter o ataque comum sem atrapalhar quem
 * esqueceu a senha: cinco tentativas é mais do que alguém erra de boa-fé,
 * e quinze minutos é curto o bastante para a pessoa não desistir do app.
 */
export const CONFIG_LIMITE = {
  JANELA_MS: 15 * 60 * 1000,
  MAX_TENTATIVAS: 5,
  BLOQUEIO_MS: 15 * 60 * 1000,
};
