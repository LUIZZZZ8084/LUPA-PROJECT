import type { TipoPagamento } from "@/server/pagamentos/tipos";

/**
 * As três compras avulsas de vaga, com o texto que explica cada uma.
 *
 * Fonte única para `/empresa/creditos` e para a seleção de plano no fim
 * do cadastro (#184) — o preço e a quantidade de créditos vêm de
 * `PRECO_CENTAVOS`/`CREDITOS_POR_COMPRA`
 * (`src/server/pagamentos/planos.ts`); isto aqui é só o rótulo e para
 * quem cada opção faz sentido, para as duas telas não divergirem no
 * texto quando uma mudar e a outra não acompanhar.
 */
export interface OpcaoDeVaga {
  tipo: TipoPagamento;
  nome: string;
  paraQuem: string;
  destaque?: boolean;
}

export const OPCOES_DE_VAGA: readonly OpcaoDeVaga[] = [
  {
    tipo: "empresa_vaga_avulsa",
    nome: "1 vaga",
    paraQuem: "Para quem tem uma vaga só, agora.",
  },
  {
    tipo: "empresa_pacote_5",
    nome: "5 vagas",
    paraQuem: "Para quem contrata algumas vezes por ano.",
  },
  {
    tipo: "empresa_pacote_10",
    nome: "10 vagas",
    paraQuem: "Para quem contrata o ano inteiro.",
    destaque: true,
  },
];
