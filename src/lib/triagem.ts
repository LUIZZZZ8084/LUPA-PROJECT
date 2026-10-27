/**
 * Perguntas de triagem: o que a empresa pergunta a quem se candidata (#491).
 *
 * A triagem de quem se candidata acontecia no WhatsApp pessoal do dono, lendo
 * currículo por currículo. Até três perguntas de sim ou não, escritas ao
 * publicar, respondidas por quem se candidata **antes** de enviar — e a
 * empresa vê quem respondeu o que a vaga exigia separado de quem não, sem
 * esconder ninguém.
 *
 * Este arquivo é compartilhado entre servidor e cliente de propósito: a tela de
 * quem se candidata, a lista da empresa e o serviço precisam concordar sobre
 * o que é "atender", e uma regra escrita em dois lugares diverge no primeiro
 * que mudar.
 */

/** Quantas perguntas uma vaga pode ter. O banco também confere. */
export const MAXIMO_DE_PERGUNTAS = 3;

export interface PerguntaDeTriagem {
  texto: string;
  /**
   * Eliminatória: a empresa espera **Sim**, e quem responde Não aparece
   * separado dos que atendem. Informativa: a resposta chega à empresa e não
   * muda o grupo de ninguém.
   *
   * "Eliminatória" não esconde nem bloqueia: quem responde Não **envia** a
   * candidatura do mesmo jeito. A lista da empresa o põe num grupo à parte,
   * com o motivo à vista — a decisão de olhar ou não continua sendo dela, e
   * a pessoa não é barrada por uma pergunta que talvez tenha entendido de
   * outro jeito.
   */
  eliminatoria: boolean;
}

/** Aceita o que vem do banco (jsonb) ou de uma chamada direta. */
export function perguntasValidas(bruto: unknown): PerguntaDeTriagem[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter(
      (p): p is { texto: string; eliminatoria?: unknown } =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { texto?: unknown }).texto === "string",
    )
    .slice(0, MAXIMO_DE_PERGUNTAS)
    .map((p) => ({ texto: p.texto, eliminatoria: p.eliminatoria === true }));
}

/** Respostas como o banco as guarda: uma lista de verdadeiro e falso. */
export function respostasValidas(bruto: unknown): boolean[] | null {
  if (!Array.isArray(bruto)) return null;
  return bruto.every((r) => typeof r === "boolean")
    ? (bruto as boolean[])
    : null;
}

/**
 * As perguntas eliminatórias que esta pessoa respondeu **Não** — o motivo que
 * a empresa lê ao lado do nome.
 *
 * Resposta que falta (candidatura que não tem a lista, ou mais curta que as
 * perguntas) conta como não respondida: numa vaga com pergunta
 * eliminatória, "não sabemos" não é "atende".
 */
export function motivosDeNaoAtender(
  perguntas: readonly PerguntaDeTriagem[],
  respostas: readonly boolean[] | null | undefined,
): string[] {
  return perguntas
    .map((p, i) => ({ p, resposta: respostas?.[i] }))
    .filter(({ p, resposta }) => p.eliminatoria && resposta !== true)
    .map(({ p }) => p.texto);
}

/**
 * A candidatura respondeu o que a vaga exigia?
 *
 * Vaga sem pergunta eliminatória — a maioria — todo mundo atende: a regra
 * só separa quando a empresa pediu para separar.
 */
export function atendeAoQueAVagaExige(
  perguntas: readonly PerguntaDeTriagem[],
  respostas: readonly boolean[] | null | undefined,
): boolean {
  return motivosDeNaoAtender(perguntas, respostas).length === 0;
}
