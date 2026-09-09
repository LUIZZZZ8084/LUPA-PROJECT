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

/**
 * Os dois estados em que uma cobrança já mexeu no dinheiro de alguém.
 *
 * É o que decide se uma cobrança é "a primeira" da pessoa (#170): quem
 * pediu devolução uma vez tem uma linha `estornado` no histórico, e a
 * próxima cobrança dela é a segunda — senão bastaria pedir devolução e
 * assinar de novo para ter primeira cobrança para sempre.
 */
export const STATUS_LIQUIDADOS: readonly StatusPagamento[] = [
  "aprovado",
  "estornado",
];

export interface Pagamento {
  id: string;
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
  status: StatusPagamento;
  mpPaymentId: string | null;
  /** Nulo em cobrança avulsa; preenchido nas parcelas da recorrência. */
  assinaturaId: string | null;
  metadata: Record<string, unknown>;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovaCobranca {
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
  assinaturaId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Uma parcela que já chegou aprovada — o caso da recorrência.
 *
 * Ao contrário de `DadosNovaCobranca`, esta cobrança não passa por
 * "pendente": quando o Mercado Pago avisa que cobrou, o dinheiro já
 * entrou. Por isso o `mpPaymentId` é obrigatório aqui — é ele que torna o
 * registro idempotente, porque o mesmo aviso chega mais de uma vez.
 */
export interface DadosCobrancaLiquidada extends DadosNovaCobranca {
  mpPaymentId: string;
}

/**
 * O ciclo de vida de uma assinatura recorrente, espelhando o `preapproval`
 * do Mercado Pago:
 *
 * - `pendente`: criada, esperando a pessoa autorizar no checkout;
 * - `ativa`: autorizada — o Mercado Pago cobra sozinho todo mês;
 * - `pausada`: ele suspendeu (cartão recusado, por exemplo);
 * - `cancelada`: não cobra mais, e é terminal.
 *
 * Cancelar **não** é o mesmo que mensalidade vencida: interrompe as
 * cobranças futuras e não devolve nada — os dias já pagos continuam
 * valendo até o fim do período.
 */
export type StatusAssinatura = "pendente" | "ativa" | "pausada" | "cancelada";

/** Enquanto a assinatura está num destes, não se cria outra para a pessoa. */
export const STATUS_ASSINATURA_VIVA: readonly StatusAssinatura[] = [
  "pendente",
  "ativa",
  "pausada",
];

export interface Assinatura {
  id: string;
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
  status: StatusAssinatura;
  mpPreapprovalId: string | null;
  /**
   * O checkout do Mercado Pago, guardado de propósito.
   *
   * Quem clica em assinar, é mandado para lá e volta sem autorizar precisa
   * cair no **mesmo** checkout ao clicar de novo. Criar um `preapproval`
   * novo a cada clique deixaria autorizações órfãs no Mercado Pago — e
   * duas autorizadas seriam duas cobranças por mês na mesma pessoa.
   */
  checkoutUrl: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosNovaAssinatura {
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
}

export interface RepositorioPagamentos {
  porId(id: string): Promise<Pagamento | null>;

  /**
   * A cobrança aprovada mais recente da pessoa, ou `null`.
   *
   * É o que a tela de assinatura precisa para saber se há algo a estornar,
   * e o serviço para saber *o quê* estornar — sem nunca receber um id do
   * formulário, que deixaria alguém pedir o estorno da cobrança de outro.
   */
  ultimoAprovado(usuarioId: string): Promise<Pagamento | null>;

  /**
   * A cobrança pelo id que o Mercado Pago usa, e não pelo nosso.
   *
   * É o que permite reconhecer uma parcela da recorrência quando o
   * estorno ou o chargeback dela chega: a referência externa de uma
   * parcela é a da **assinatura**, não a de uma cobrança nossa, então
   * `porId` não a acha. Sem este caminho, um chargeback de renovação
   * passaria batido — e o chargeback fraudulento é justamente o caso que
   * fez a revogação existir.
   */
  porMpPaymentId(mpPaymentId: string): Promise<Pagamento | null>;

  /**
   * Quantas cobranças da pessoa já mexeram no dinheiro dela — aprovadas
   * mais estornadas (`STATUS_LIQUIDADOS`).
   *
   * A devolução vale só na primeira (#170), e "primeira" é `1` aqui.
   * Contar só as aprovadas deixaria quem já pediu devolução voltar à casa
   * de partida a cada assinatura nova.
   */
  contarLiquidadas(usuarioId: string): Promise<number>;

  criar(dados: DadosNovaCobranca): Promise<Pagamento>;

  /**
   * Grava uma parcela da recorrência, que já nasce aprovada.
   *
   * Devolve `null` quando aquele `mpPaymentId` já estava registrado — é o
   * que torna o aviso de cobrança recorrente idempotente, e a garantia
   * mora no índice único de `pagamentos.mp_payment_id`, não numa leitura
   * antes da escrita: o Mercado Pago reenvia, e duas notificações chegando
   * juntas estenderiam 60 dias por uma cobrança só.
   */
  registrarLiquidada(dados: DadosCobrancaLiquidada): Promise<Pagamento | null>;

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

  // ── Assinaturas recorrentes (#170) ────────────────────────────────────

  /**
   * A assinatura que ainda vale alguma coisa — pendente, ativa ou pausada
   * (`STATUS_ASSINATURA_VIVA`), a mais recente.
   *
   * É quem responde "esta pessoa já assinou?" sem consultar o Mercado Pago
   * a cada abertura da tela.
   */
  assinaturaViva(usuarioId: string): Promise<Assinatura | null>;

  assinaturaPorId(id: string): Promise<Assinatura | null>;

  /** Achar a assinatura a partir do que o webhook manda — o id de lá. */
  assinaturaPorMpId(mpPreapprovalId: string): Promise<Assinatura | null>;

  criarAssinatura(dados: DadosNovaAssinatura): Promise<Assinatura>;

  vincularAssinaturaAoMercadoPago(
    id: string,
    dados: { mpPreapprovalId: string; checkoutUrl: string | null },
  ): Promise<Assinatura>;

  /**
   * Espelha aqui o status que o Mercado Pago informou.
   *
   * Condicional em dois sentidos: não faz nada se o status já é esse — e
   * `cancelada` é terminal, então nunca se sai dela. Sem essa segunda
   * guarda, um aviso atrasado de "autorizada" chegando **depois** do
   * cancelamento ressuscitaria uma assinatura que a pessoa encerrou.
   * Devolve `null` quando não mudou nada.
   */
  definirStatusAssinatura(
    id: string,
    status: StatusAssinatura,
  ): Promise<Assinatura | null>;
}
