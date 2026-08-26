import { isSupabaseConfigured } from "@/lib/supabase/config";
import { log } from "../logger";
import { RepositorioBuscasMemoria } from "./memoria";
import { RepositorioBuscasPostgres } from "./postgres";
import {
  type OndeBuscou,
  type RepositorioBuscas,
  termoParaEstatistica,
} from "./tipos";

const memoria = new RepositorioBuscasMemoria();

let cache: RepositorioBuscas | null = null;

export function repositorioBuscas(): RepositorioBuscas {
  if (!cache) {
    cache = isSupabaseConfigured ? new RepositorioBuscasPostgres() : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioBuscas(repo: RepositorioBuscas): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

/**
 * Conta uma busca que não achou nada, sem deixar a falha chegar na tela.
 *
 * Quem buscou quer ver o resultado — mesmo que o resultado seja "nada
 * encontrado". A estatística é para nós; derrubar a busca por causa dela
 * seria trocar o essencial pelo acessório.
 *
 * Termo que não vale contar é descartado aqui, e não no chamador: assim a
 * regra do que entra na estatística vive num lugar só.
 */
export async function contarBuscaSemResultado(
  bruto: string | undefined,
  onde: OndeBuscou,
): Promise<void> {
  const termo = bruto && termoParaEstatistica(bruto);
  if (!termo) return;

  try {
    await repositorioBuscas().registrar(termo, onde);
  } catch (e) {
    log.warn("não foi possível contar a busca sem resultado", {
      acao: "busca.sem_resultado",
      erro: e instanceof Error ? e.message : String(e),
    });
  }
}

export type { OndeBuscou, RepositorioBuscas };
export { RepositorioBuscasMemoria, termoParaEstatistica };
