/**
 * Cobrança via Mercado Pago.
 *
 * `tipo` nasce só com `"prestador_mensalidade"`, o primeiro uso real desta
 * infraestrutura. Vaga avulsa, planos de empresa e o gerador de currículo
 * pago ganham o próprio valor quando cada um tiver uma tela que o use —
 * um tipo aceito pelo banco sem nenhum efeito implementado seria promessa
 * sem a outra ponta construída.
 */

export type TipoPagamento = "prestador_mensalidade";

export type StatusPagamento =
  | "pendente"
  | "aprovado"
  | "rejeitado"
  | "cancelado"
  | "estornado";

export interface Pagamento {
  id: string;
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
  status: StatusPagamento;
  mpPreferenceId: string | null;
  mpPaymentId: string | null;
  metadata: Record<string, unknown>;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovaCobranca {
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
  metadata?: Record<string, unknown>;
}

export interface RepositorioPagamentos {
  porId(id: string): Promise<Pagamento | null>;
  criar(dados: DadosNovaCobranca): Promise<Pagamento>;
  definirPreferencia(id: string, mpPreferenceId: string): Promise<Pagamento>;
  /**
   * Só muda o status se ele ainda estiver `"pendente"` — a troca é
   * condicional na própria instrução, não "lê, decide, grava" em dois
   * passos, porque o Mercado Pago reenvia webhook, e duas notificações
   * chegando ao mesmo tempo não podem aplicar o efeito duas vezes.
   * Devolve `null` quando não havia mais nada pendente para aprovar.
   *
   * `mpPaymentId` é `null` em modo demonstração, sem chamada ao Mercado Pago.
   */
  aprovar(id: string, mpPaymentId: string | null): Promise<Pagamento | null>;
  rejeitar(id: string, mpPaymentId: string | null): Promise<Pagamento | null>;

  /** Cobrança que o comprador desistiu antes de pagar. */
  cancelar(id: string, mpPaymentId: string | null): Promise<Pagamento | null>;

  /**
   * Estorno ou chargeback — e este parte de `"aprovado"`, não de
   * `"pendente"`.
   *
   * É a diferença que faz esta operação existir separada: os outros três
   * desfechos resolvem uma cobrança que ainda estava em aberto, e por isso
   * a guarda deles é `status = 'pendente'`. Estorno acontece **depois** de
   * o dinheiro ter entrado, sobre uma cobrança já aprovada — a mesma
   * guarda ali recusaria a transição e o dinheiro voltaria sem ninguém
   * saber.
   *
   * Continua condicional pelo mesmo motivo dos outros: o Mercado Pago
   * reenvia webhook, e a reversão do efeito não pode acontecer duas vezes.
   * `null` quando outra notificação já resolveu.
   */
  estornar(id: string, mpPaymentId: string | null): Promise<Pagamento | null>;
}
