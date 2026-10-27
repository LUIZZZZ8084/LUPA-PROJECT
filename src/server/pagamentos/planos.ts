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
   * Publicar vaga: a avulsa e três planos (#489), decisão do Luiz em
   * 26/10/2026 — 19,90 / 49,90 / 79,90 / 99,90.
   *
   * A tabela de 14/10 (#469) era 19,90 / pacote de 5 por 79,90 / pacote de 10
   * por 99,90 / mensal de 149,90. Os pacotes não renovavam: quem comprava 10
   * tinha 10 e, acabando, tinha de decidir comprar de novo. Plano que se
   * repete dá ao dono um motivo para voltar e à Lupa uma receita que se
   * prevê. A concorrência anuncia vaga de graça e cobra por resultado; o
   * mais parecido, o Pense Empregos, cobra R$ 99 por 10 vagas e R$ 199 pelo
   * ilimitado — a Lupa fica abaixo nos dois.
   *
   * O limite dos planos é de vagas **no ar ao mesmo tempo**, e não de vagas
   * por mês: cada vaga já vale 30 dias, e "5 no ar" se entende sem conta.
   *
   * **A escada tem de se sustentar**, e há teste que a cobra: o plano de 5
   * custa mais que a avulsa (quem publica uma vaga por mês não assina), o
   * de 10 mais que o de 5 e o ilimitado mais que o de 10 — e o preço por vaga
   * sai de cima para baixo. A avulsa é a âncora: com três avulsas no mês
   * (59,70), o plano de 5 já compensa.
   */
  empresa_vaga_avulsa: 1990,
  empresa_plano_5: 4990,
  empresa_plano_10: 7990,
  empresa_mensal: 9990,

  /** Currículo em PDF (#47), compra única e permanente. */
  curriculo_pdf: 1490,
};

export const DESCRICAO_PAGAMENTO: Record<TipoPagamento, string> = {
  prestador_mensalidade: "Mensalidade de prestador — Lupa",
  empresa_vaga_avulsa: "1 vaga — Lupa",
  empresa_plano_5: "Plano 5 vagas no ar, mensal — Lupa",
  empresa_plano_10: "Plano 10 vagas no ar, mensal — Lupa",
  empresa_mensal: "Plano ilimitado, mensal — Lupa",
  curriculo_pdf: "Gerador de currículo em PDF — Lupa",
};

/**
 * Quantos créditos de vaga cada compra entrega.
 *
 * Só o pagamento único aparece aqui: os planos não dão crédito nenhum de
 * propósito — enquanto valem, publicar não gasta crédito, e misturar os
 * dois faria a pessoa acumular saldo que não precisa usar.
 */
export const CREDITOS_POR_COMPRA: Partial<Record<TipoPagamento, number>> = {
  empresa_vaga_avulsa: 1,
};

/**
 * Os planos de vaga e quantas vagas cada um deixa no ar ao mesmo tempo
 * (#489). `null` é sem limite: o ilimitado.
 *
 * Preço e limite moram no mesmo arquivo de propósito — é aqui que se
 * confere se o "5 vagas" do plano continua sendo cinco.
 */
export const VAGAS_NO_AR_POR_PLANO: Partial<
  Record<TipoPagamento, number | null>
> = {
  empresa_plano_5: 5,
  empresa_plano_10: 10,
  empresa_mensal: null,
};

export const TIPOS_DE_PLANO_DE_VAGA = Object.keys(
  VAGAS_NO_AR_POR_PLANO,
) as TipoPagamento[];

export function ehPlanoDeVaga(tipo: TipoPagamento): boolean {
  return TIPOS_DE_PLANO_DE_VAGA.includes(tipo);
}

/**
 * Qual plano tem este limite — a carteira guarda o limite, e não o tipo, e
 * a tela precisa dizer "Plano 5" e não "5".
 */
export function planoPorLimite(limite: number | null): TipoPagamento | null {
  return (
    TIPOS_DE_PLANO_DE_VAGA.find((t) => VAGAS_NO_AR_POR_PLANO[t] === limite) ??
    null
  );
}

/**
 * Os tipos que são assinatura recorrente, e não pagamento único.
 *
 * É o que decide qual caminho do Mercado Pago a compra percorre:
 * `preapproval` (autoriza o cartão e cobra sozinho todo mês) ou Checkout
 * Pro (cobra uma vez e acabou).
 */
export const TIPOS_RECORRENTES: readonly TipoPagamento[] = [
  "prestador_mensalidade",
  "empresa_plano_5",
  "empresa_plano_10",
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
