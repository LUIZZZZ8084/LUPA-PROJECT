/**
 * A parceria sem prazo, do jeito que as telas a reconhecem (#505).
 *
 * O benefício do parceiro mora nas mesmas colunas que o pagamento usa — a
 * validade da mensalidade do prestador e a do plano de vagas da empresa —,
 * para a vitrine, a publicação e o painel não precisarem saber de parceria
 * nenhuma. "Sem prazo" é uma validade que nunca chega: o ano 2100.
 *
 * As telas que mostram a validade perguntam aqui, para dizer "parceria" em
 * vez de "vale até 01/01/2100" — e para não oferecer pagar a quem já tem.
 */
export const VALIDADE_SEM_PRAZO = "2100-01-01T00:00:00.000Z";

/**
 * Daqui em diante a validade é de parceria sem prazo: a própria marca.
 *
 * A conta que a grava (`diasParaChegarA`) arredonda os dias para cima, então
 * a validade de parceria nunca fica antes dela. Já houve um ano de folga, e
 * ele engolia a vitrine vitalícia de 2099-12-31 (#245), que não é parceria
 * (#519). E a data sozinha não basta: as telas também perguntam ao registro
 * (`ehParceiroSemPrazo`).
 */
const LIMIAR_SEM_PRAZO = Date.parse(VALIDADE_SEM_PRAZO);

export function ehSemPrazo(validade: string | null | undefined): boolean {
  if (!validade) return false;
  const quando = Date.parse(validade);
  return Number.isFinite(quando) && quando >= LIMIAR_SEM_PRAZO;
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Quantos dias faltam para a validade chegar a `alvo`, contando de onde ela
 * já está — ou de agora, se já venceu.
 *
 * As funções do banco que estendem validade somam dias a `max(agora,
 * validade atual)` numa instrução só (#348). A parceria quer outra coisa:
 * "pelo menos até tal data". Esta conta traduz uma na outra, e é o que faz
 * conceder duas vezes não estender duas vezes: a segunda chamada pede zero
 * dias. Zero ou menos quer dizer que já vale até lá.
 */
export function diasParaChegarA(
  alvo: string,
  atual: string | null,
  agora: Date = new Date(),
): number {
  const base = Math.max(agora.getTime(), atual ? Date.parse(atual) : 0);
  return Math.ceil((Date.parse(alvo) - base) / UM_DIA_MS);
}

/**
 * A validade da conta ainda é a que a parceria deu, e não uma que a pessoa
 * pagou além dela?
 *
 * Encerrar a parceria tira o benefício — mas não os dias que a conta pagou
 * por conta própria depois do prazo da parceria. A folga de dois dias cobre
 * o arredondamento de `diasParaChegarA`, que conta dias inteiros a partir da
 * hora em que a concessão aconteceu.
 */
export function aindaEDaParceria(
  validade: string | null,
  concedidoAte: string,
): boolean {
  if (!validade) return false;
  return Date.parse(validade) <= Date.parse(concedidoAte) + 2 * UM_DIA_MS;
}
