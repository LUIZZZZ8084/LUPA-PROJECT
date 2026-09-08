import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioPagamentosMemoria } from "./memoria";
import { RepositorioPagamentosPostgres } from "./postgres";
import type { RepositorioPagamentos } from "./tipos";

const memoria = new RepositorioPagamentosMemoria();

let cache: RepositorioPagamentos | null = null;

export function repositorioPagamentos(): RepositorioPagamentos {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioPagamentosPostgres()
      : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioPagamentos(
  repo: RepositorioPagamentos,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioPagamentos };
export { RepositorioPagamentosMemoria };
