/**
 * A carteira de quem publica vaga (#172).
 *
 * Duas formas de ter direito a publicar, e elas não se somam: créditos
 * comprados avulsos ou em pacote, e o plano mensal, que enquanto vale
 * dispensa crédito. Quem tem mensal ativo publica sem gastar nada — e os
 * créditos que já tinha continuam lá para quando o mensal acabar.
 *
 * A chave é `usuarioId`, não um `empresaId`: desde a #129 quem publica
 * vaga também pode ser prestador contratando ajudante, e ele não tem
 * perfil de empresa no momento em que compra o primeiro crédito.
 *
 * **A tela não diz "crédito" em lugar nenhum, e isso é deliberado.** Aqui
 * dentro o nome continua esse — é o que a coisa é: um contador pré-pago,
 * consumido por publicação. Para quem compra, "crédito" sugere saldo que
 * recarrega no fim do mês, que é exatamente o que **não** acontece:
 * decisão do Luiz em 09/09/2026, quem paga 5 ou 10 tem 5 ou 10, não
 * renova, e querer mais é comprar de novo. A interface fala em "vagas
 * para publicar" e em "saldo"; a divergência entre os dois vocabulários é
 * escolha, não descuido — renomear `creditos_vaga` no banco custaria
 * migração em produção e não mudaria uma palavra do que a pessoa lê.
 */
export interface Carteira {
  usuarioId: string;
  creditosVaga: number;
  mensalidadeValidaAte: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface RepositorioCarteiras {
  /**
   * A carteira da pessoa, ou `null` se ela nunca comprou nada.
   *
   * `null` e "carteira zerada" são a mesma coisa para quem pergunta, e é
   * de propósito que a linha não nasça junto com a conta: a esmagadora
   * maioria das contas nunca publica vaga.
   */
  porUsuario(usuarioId: string): Promise<Carteira | null>;

  /**
   * Soma créditos, criando a carteira se ainda não existir.
   *
   * `on conflict do update` numa instrução só — dois pagamentos aprovados
   * quase juntos pelo caminho ler-somar-gravar leriam o mesmo saldo e
   * gravariam o mesmo total, e a empresa pagaria dois pacotes para
   * receber um. É a mesma corrida que o contador de tentativas já resolve
   * no banco.
   */
  creditar(usuarioId: string, quantidade: number): Promise<Carteira>;

  /**
   * Gasta um crédito, e **só se houver um**.
   *
   * Devolve `null` quando o saldo era zero — a condição mora na própria
   * instrução (`where creditos_vaga > 0`), não numa leitura antes da
   * escrita: duas publicações simultâneas com um crédito só passariam as
   * duas por um `select` anterior.
   */
  consumirCredito(usuarioId: string): Promise<Carteira | null>;

  /**
   * Tira créditos de volta — o caminho do estorno e do chargeback.
   *
   * Nunca abaixo de zero: se a pessoa já gastou o que comprou e depois
   * contestou a cobrança, o saldo para em zero em vez de virar dívida.
   * A vaga que ela publicou continua publicada; o que se recupera é o que
   * ainda não foi usado.
   */
  debitar(usuarioId: string, quantidade: number): Promise<Carteira>;

  /**
   * Estende o plano mensal a partir do maior entre "agora" e o que já
   * valia — quem renova antes de vencer não perde os dias pagos, mesma
   * regra da mensalidade de prestador.
   */
  estenderMensalidade(usuarioId: string, dias: number): Promise<Carteira>;

  /** Derruba o plano mensal na hora — estorno e chargeback. */
  revogarMensalidade(usuarioId: string): Promise<Carteira>;
}
