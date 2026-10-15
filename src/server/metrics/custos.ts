import type { CustoMensal } from "./tipos";

/**
 * O custo mensal que o Lupa precisa cobrir para se pagar (#471).
 *
 * São **estimativas**, em reais, dos dois planos pagos que o projeto vai
 * usar: Supabase Pro (US$ 25) e Vercel Pro (US$ 20), com o dólar a
 * R$ 5,15 e o IOF de cartão internacional (~3,5%) — conta feita em
 * 15/10/2026, a pedido do Luiz: "precisamos que o Lupa se pague pelo menos
 * o Supabase". Os dois planos ainda são os grátis; isto é a meta, não a
 * fatura. Quando a primeira fatura chegar, o número dela é o certo, e é
 * aqui que ele muda.
 *
 * O CNPJ e o resto do custo da empresa ficam de fora de propósito: o
 * painel responde se o produto paga a infraestrutura dele, e essa conta
 * não depende de quanto custa a contabilidade.
 */
export const CUSTOS_MENSAIS: readonly CustoMensal[] = [
  { nome: "Supabase Pro", centavos: 13_300 },
  { nome: "Vercel Pro", centavos: 10_700 },
];
