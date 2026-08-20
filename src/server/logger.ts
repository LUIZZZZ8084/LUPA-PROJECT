import { scrubSensitiveData } from "@/lib/observability";
import type { AppError } from "./errors";

/**
 * Log estruturado.
 *
 * Sai em JSON de uma linha porque é o que a Vercel e qualquer coletor
 * conseguem indexar. Log em prosa é bonito no terminal e inútil às três da
 * manhã quando alguém precisa achar por que um cadastro falhou.
 *
 * Todo objeto passa por `scrubSensitiveData` antes de sair: telefone, CPF,
 * CNPJ e documento não podem aparecer em log, nem no nosso.
 */

export type Nivel = "debug" | "info" | "warn" | "error";

const ORDEM: Record<Nivel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const NIVEL_MINIMO: Nivel =
  (process.env.LOG_LEVEL as Nivel | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

export interface ContextoLog {
  /** Liga todas as linhas de uma mesma requisição. */
  requestId?: string;
  /** Papel de quem chamou. Nunca o id nem o e-mail. */
  papel?: string;
  /** Ação em curso, ex.: "auth.login". */
  acao?: string;
  /** Duração em milissegundos. */
  ms?: number;
  /** Identificador do erro, o mesmo que a pessoa vê na tela. */
  erroId?: string;
  [chave: string]: unknown;
}

function emitir(nivel: Nivel, mensagem: string, contexto?: ContextoLog) {
  if (ORDEM[nivel] < ORDEM[NIVEL_MINIMO]) return;

  const linha = {
    nivel,
    hora: new Date().toISOString(),
    mensagem,
    ...(contexto ? (scrubSensitiveData(contexto) as ContextoLog) : {}),
  };

  const saida = JSON.stringify(linha);

  // console.error para warn e error para que a Vercel separe os fluxos.
  if (nivel === "error" || nivel === "warn") console.error(saida);
  else console.log(saida);
}

export const log = {
  debug: (mensagem: string, contexto?: ContextoLog) =>
    emitir("debug", mensagem, contexto),
  info: (mensagem: string, contexto?: ContextoLog) =>
    emitir("info", mensagem, contexto),
  warn: (mensagem: string, contexto?: ContextoLog) =>
    emitir("warn", mensagem, contexto),

  /**
   * Registra um AppError já classificado.
   *
   * Erro esperado (validação, senha errada, sem permissão) sai como `warn`:
   * é o sistema funcionando. Só o inesperado vira `error`, para que o alerta
   * signifique alguma coisa em vez de tocar o dia inteiro.
   */
  erro: (erro: AppError, contexto?: ContextoLog) => {
    const esperado =
      erro.codigo !== "interno" && erro.codigo !== "indisponivel";
    emitir(esperado ? "warn" : "error", erro.message, {
      ...contexto,
      ...erro.contexto,
      erroId: erro.id,
      codigo: erro.codigo,
      ...(esperado ? {} : { stack: erro.stack }),
    });
  },
};

/** Identificador de requisição, para amarrar as linhas de uma mesma chamada. */
export function novoRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Cronômetro simples. Duração em log é o que revela a consulta lenta antes
 * de o usuário reclamar.
 */
export function cronometro() {
  const inicio = performance.now();
  return () => Math.round(performance.now() - inicio);
}
