import type { TipoPagamento } from "./tipos";

/**
 * Preço em centavos, por tipo de cobrança — fonte única, para a tela de
 * compra e o servidor nunca divergirem sobre quanto custa cada coisa.
 */
export const PRECO_CENTAVOS: Record<TipoPagamento, number> = {
  // R$ 19,90 — decisão do Luiz em 08/09/2026, que também é quem reverteu
  // a espera por demanda antes de cobrar (decidida em 25/08).
  prestador_mensalidade: 1990,
};

export const DESCRICAO_PAGAMENTO: Record<TipoPagamento, string> = {
  prestador_mensalidade: "Mensalidade de prestador — Lupa",
};
