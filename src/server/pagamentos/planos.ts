import type { TipoPagamento } from "./tipos";

/**
 * Preço em centavos, por tipo de cobrança — fonte única, para a tela de
 * compra e o servidor nunca divergirem sobre quanto custa cada coisa.
 */
export const PRECO_CENTAVOS: Record<TipoPagamento, number> = {
  // R$ 19,90 — decisão do Luiz em 08/09/2026, que também é quem reverteu
  // a espera por demanda antes de cobrar (decidida em 25/08).
  prestador_mensalidade: 1990,

  /*
   * Publicar vaga (#172), e a tabela de agora é a de 14/10/2026 (#469),
   * decisão do Luiz: 19,90 / 79,99 / 99,90 e mensal de 149,90.
   *
   * O preço por vaga sai 19,90 / 16,00 / 9,99: a avulsa custa o **dobro**
   * do unitário do pacote de 10, e o de 5 fica no meio. A tabela anterior
   * era 29,90 / 119,90 / 149,90 e mensal de 199,90 (a primeira, de 09/09,
   * tinha pacote de 15 e avulsa a três vezes o unitário dele — quem tinha
   * uma vaga só olhava aquilo como punição).
   *
   * **O teto é o plano mensal**, e é ele que segura a escada: 12 vagas
   * saem por 139,70 (o pacote de 10 e duas avulsas), e 13 já custam 159,60,
   * mais que os 149,90 do mensal. É exatamente aí que ele deve ganhar. Um pacote que custasse perto
   * dos 149,90 não venderia, porque a essa altura vale mais assinar — e há
   * teste que reprova uma tabela em que o unitário não cai com o pacote ou
   * o mensal sai mais barato que o pacote de 10.
   *
   * O pacote de 10 custa só 19,91 a mais que o de 5: quem escolhe o de 5
   * escolhe pelo valor que sai do bolso, não pela conta por vaga.
   */
  empresa_vaga_avulsa: 1990,
  empresa_pacote_5: 7999,
  empresa_pacote_10: 9990,
  empresa_mensal: 14990,

  /** Currículo em PDF (#47), compra única e permanente. */
  curriculo_pdf: 1490,
};

export const DESCRICAO_PAGAMENTO: Record<TipoPagamento, string> = {
  prestador_mensalidade: "Mensalidade de prestador — Lupa",
  empresa_vaga_avulsa: "1 vaga — Lupa",
  empresa_pacote_5: "5 vagas — Lupa",
  empresa_pacote_10: "10 vagas — Lupa",
  empresa_mensal: "Vagas ilimitadas, mensal — Lupa",
  curriculo_pdf: "Gerador de currículo em PDF — Lupa",
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
  empresa_pacote_10: 10,
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
