import type { DadosDoCusto } from "./tipos";

/**
 * Os custos com que a lista nasce (#473) — os mesmos que a #471 deixou
 * escritos no código, e que agora o admin edita no painel.
 *
 * São **estimativas**, em reais, dos dois planos pagos que o projeto vai
 * usar: Supabase Pro (US$ 25) e Vercel Pro (US$ 20), com o dólar a
 * R$ 5,15 e o IOF de cartão internacional (~3,5%) — conta feita em
 * 15/10/2026. Quando a primeira fatura chegar, o admin troca pelo valor
 * dela, no painel.
 *
 * A mesma lista está no `schema.sql` e no `aplica-custos-mensais.sql`, e o
 * `schema.test.ts` confere que o banco nasce com ela.
 */
export const CUSTOS_INICIAIS: readonly DadosDoCusto[] = [
  { nome: "Supabase Pro", centavos: 13_300 },
  { nome: "Vercel Pro", centavos: 10_700 },
];
