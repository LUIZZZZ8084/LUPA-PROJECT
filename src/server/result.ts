import { type AppError, comoAppError } from "./errors";

/**
 * Resultado tipado.
 *
 * O TypeScript não sabe o que uma função lança, então `try/catch` espalhado
 * deixa caminhos de erro sem tratamento sem que nada avise. Devolvendo
 * `Resultado`, o compilador obriga a olhar o caso de falha antes de usar o
 * valor — que é o ponto quando a prioridade é não quebrar em produção.
 */

export type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; erro: AppError };

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

export function falha<T = never>(erro: AppError): Resultado<T> {
  return { ok: false, erro };
}

/** Executa algo que pode lançar e devolve Resultado. */
export async function tentar<T>(
  fn: () => Promise<T> | T,
): Promise<Resultado<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return falha(comoAppError(e));
  }
}

/** Encadeia transformação só no caminho feliz. */
export function mapear<T, U>(
  resultado: Resultado<T>,
  fn: (valor: T) => U,
): Resultado<U> {
  return resultado.ok ? ok(fn(resultado.valor)) : resultado;
}

/**
 * Extrai o valor ou lança. Use só na borda mais externa, onde alguém já
 * captura — no meio da lógica, derrota o propósito do tipo.
 */
export function desempacotar<T>(resultado: Resultado<T>): T {
  if (resultado.ok) return resultado.valor;
  throw resultado.erro;
}
