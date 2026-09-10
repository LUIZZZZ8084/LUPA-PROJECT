/**
 * Cobrança via Mercado Pago.
 *
 * Cada valor de `tipo` só existe quando tem tela que o venda e efeito
 * implementado — um tipo aceito pelo banco sem a outra ponta construída
 * seria a mesma promessa vazia que derrubou a fila de verificação manual.
 * A trava de exaustividade do `switch` em `aplicarEfeito` é o que cobra
 * isso: acrescentar um valor aqui sem tratá-lo lá quebra o build.
 *
 * O gerador de currículo pago (#47) continua de fora pelo mesmo motivo.
 */

export type TipoPagamento =
  | "prestador_mensalidade"
  /** Publicar vaga (#172): três compras únicas que viram crédito… */
  | "empresa_vaga_avulsa"
  | "empresa_pacote_5"
  | "empresa_pacote_10"
  /** …e uma assinatura mensal, que dispensa crédito enquanto vale. */
  | "empresa_mensal";

/**
 * Os seis desfechos de uma cobrança.
 *
 * `estornado` e `contestado` são os dois que tiram dinheiro, e são
 * separados de propósito — decisão do Luiz em 10/09/2026 (#179), quando
 * "todo valor que entra deve ser registrado, e o que sai também" virou a
 * regra do caixa.
 *
 * Até aqui os dois caíam em `estornado`, porque o efeito no app é o mesmo:
 * a mensalidade cai na hora. Só que o efeito é o que eles têm em comum, e
 * não o que eles são:
 *
 * - **`estornado`** — nós devolvemos. Foi decisão da casa.
 * - **`contestado`** — o cliente abriu disputa no cartão (`charged_back`).
 *   Custa taxa do Mercado Pago, é sinal de fraude ou de compra que a
 *   pessoa não reconheceu, e dá para contestar de volta.
 *
 * A informação chega uma vez só, no webhook, e some se não for gravada
 * ali — depois não há como saber qual saída foi qual.
 */
export type StatusPagamento =
  | "pendente"
  | "aprovado"
  | "rejeitado"
  | "cancelado"
  | "estornado"
  | "contestado";

export interface Pagamento {
  id: string;
  usuarioId: string;
  tipo: TipoPagamento;
  valorCentavos: number;
  status: StatusPagamento;
  /** Só nas compras únicas: a recorrência não passa por preferência. */
  mpPreferenceId: string | null;
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
   * Alguma parcela desta assinatura já foi cobrada de verdade?
   *
   * É o que separa "está no teste grátis" de "já está pagando" — e a
   * tela precisa da diferença para não dizer a frase errada. Durante o
   * teste, "nada é devolvido" soa como ameaça a quem não pagou nada
   * ainda; depois da primeira cobrança, é a informação que evita a
   * pessoa achar que cancelar apaga o mês que ela pagou.
   */
  temParcelaAprovada(assinaturaId: string): Promise<boolean>;

  criar(dados: DadosNovaCobranca): Promise<Pagamento>;

  definirPreferencia(id: string, mpPreferenceId: string): Promise<Pagamento>;

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
   * Dinheiro de volta — e esta parte de `"aprovado"`, não de `"pendente"`.
   *
   * É a diferença que faz esta operação existir separada: os outros três
   * desfechos resolvem uma cobrança que ainda estava em aberto, e por isso
   * a guarda deles é `status = 'pendente'`. Devolução acontece **depois**
   * de o dinheiro ter entrado, sobre uma cobrança já aprovada — a mesma
   * guarda ali recusaria a transição e o dinheiro voltaria sem ninguém
   * saber.
   *
   * `saida` diz **qual** das duas foi, e é o que o webhook sabe e mais
   * ninguém: `refunded` é devolução nossa, `charged_back` é disputa aberta
   * pelo cliente. Gravar isso aqui é a única chance — depois as duas viram
   * "saiu dinheiro" e não há como separar.
   *
   * Continua condicional pelo mesmo motivo dos outros: o Mercado Pago
   * reenvia webhook, e a reversão do efeito não pode acontecer duas vezes.
   * `null` quando outra notificação já resolveu.
   */
  estornar(
    id: string,
    mpPaymentId: string | null,
    saida?: "estornado" | "contestado",
  ): Promise<Pagamento | null>;

  // ── Assinaturas recorrentes (#170) ────────────────────────────────────

  /**
   * A assinatura **daquele tipo** que ainda vale alguma coisa — pendente,
   * ativa ou pausada (`STATUS_ASSINATURA_VIVA`), a mais recente.
   *
   * O tipo não é detalhe: desde a #172 a mesma pessoa pode ter duas
   * assinaturas vivas ao mesmo tempo — a mensalidade de prestador, que
   * põe o perfil na vitrine, e o plano mensal de vagas, que deixa
   * publicar sem gastar crédito. Um prestador que contrata ajudante tem
   * as duas, e procurar só por `usuario_id` devolveria uma no lugar da
   * outra: cancelar o plano de vagas cancelaria a vitrine.
   */
  assinaturaViva(
    usuarioId: string,
    tipo: TipoPagamento,
  ): Promise<Assinatura | null>;

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
