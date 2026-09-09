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

/**
 * Dias de teste grátis antes da primeira cobrança da assinatura —
 * decisão do Luiz em 09/09/2026 (#170), substituindo os 30 dias de
 * carência sem cartão que `virarPrestador` dava antes de existir
 * assinatura recorrente.
 *
 * A diferença que importa: aqui o cartão já foi autorizado quando o teste
 * começa. Quem cancela dentro do prazo nunca chegou a ser cobrado — não
 * há dinheiro para devolver, e por isso não é a mesma coisa que a
 * carência antiga, que não pedia cartão nenhum.
 */
export const DIAS_TESTE_GRATIS = 15;
