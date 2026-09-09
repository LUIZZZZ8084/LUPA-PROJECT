import type { TipoPagamento } from "./tipos";

/**
 * Preço em centavos, por tipo de cobrança — fonte única, para a tela de
 * compra e o servidor nunca divergirem sobre quanto custa cada coisa.
 */
export const PRECO_CENTAVOS: Record<TipoPagamento, number> = {
  // R$ 19,90 — decisão do Luiz em 08/09/2026, que também é quem reverteu
  // a espera por demanda antes de cobrar (decidida em 25/08).
  prestador_mensalidade: 1990,

  // Publicar vaga (#172), decidido pelo Luiz em 09/09/2026. Os três
  // primeiros são pagamento único e viram crédito; o último é assinatura.
  empresa_vaga_avulsa: 2990,
  empresa_pacote_5: 10000,
  empresa_pacote_15: 14990,
  empresa_mensal: 19990,
};

export const DESCRICAO_PAGAMENTO: Record<TipoPagamento, string> = {
  prestador_mensalidade: "Mensalidade de prestador — Lupa",
  empresa_vaga_avulsa: "1 vaga — Lupa",
  empresa_pacote_5: "5 vagas — Lupa",
  empresa_pacote_15: "15 vagas — Lupa",
  empresa_mensal: "Vagas ilimitadas, mensal — Lupa",
};

/**
 * Quantos créditos de vaga cada compra entrega.
 *
 * Só os pagamentos únicos aparecem aqui: `empresa_mensal` não dá crédito
 * nenhum de propósito — enquanto vale, publicar não gasta crédito, e
 * misturar os dois faria a pessoa acumular saldo que não precisa usar.
 */
export const CREDITOS_POR_COMPRA: Partial<Record<TipoPagamento, number>> = {
  empresa_vaga_avulsa: 1,
  empresa_pacote_5: 5,
  empresa_pacote_15: 15,
};

/**
 * Os tipos que são assinatura recorrente, e não pagamento único.
 *
 * É o que decide qual caminho do Mercado Pago a compra percorre:
 * `preapproval` (autoriza o cartão e cobra sozinho todo mês) ou Checkout
 * Pro (cobra uma vez e acabou).
 */
export const TIPOS_RECORRENTES: readonly TipoPagamento[] = [
  "prestador_mensalidade",
  "empresa_mensal",
];

export function ehRecorrente(tipo: TipoPagamento): boolean {
  return TIPOS_RECORRENTES.includes(tipo);
}

/**
 * Dias de teste grátis antes da primeira cobrança da assinatura —
 * decisão do Luiz em 09/09/2026 (#170), substituindo os 30 dias de
 * carência sem cartão que `virarPrestador` dava antes de existir
 * assinatura recorrente.
 *
 * A diferença que importa: aqui o cartão já foi autorizado quando o teste
 * começa. Quem cancela dentro do prazo nunca chegou a ser cobrado — não
 * há dinheiro para devolver, e é por isso que a devolução self-service
 * deixou de existir (#170): esta é a janela para desistir.
 *
 * Vale só para a mensalidade de prestador. O plano mensal de vagas não
 * tem teste: quem contrata publica a vaga no primeiro dia e teria o
 * resultado inteiro do mês antes de qualquer cobrança.
 */
export const DIAS_TESTE_GRATIS = 15;

export function diasDeTeste(tipo: TipoPagamento): number {
  return tipo === "prestador_mensalidade" ? DIAS_TESTE_GRATIS : 0;
}
