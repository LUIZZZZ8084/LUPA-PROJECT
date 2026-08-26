/**
 * O contrato do limite de tentativas.
 *
 * Duas implementações e um contrato, como o resto do servidor: memória
 * para a demonstração e para o teste, Postgres para produção. O que os
 * testes exercitam é a mesma regra que roda em produção.
 */

export interface RepositorioLimite {
  /** Até quando a chave está bloqueada, ou `null` se não está. */
  bloqueadoAte(chave: string): Promise<Date | null>;

  /** Soma uma falha e bloqueia ao atingir o teto. */
  registrarFalha(chave: string): Promise<void>;

  /** Zera o contador. */
  registrarSucesso(chave: string): Promise<void>;
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
