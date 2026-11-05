import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioAcompanhamentoMemoria } from "./memoria";
import { RepositorioAcompanhamentoPostgres } from "./postgres";
import type { RepositorioAcompanhamento } from "./tipos";

let cache: RepositorioAcompanhamento | null = null;

export function repositorioAcompanhamento(): RepositorioAcompanhamento {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioAcompanhamentoPostgres()
      : new RepositorioAcompanhamentoMemoria();
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioAcompanhamento(
  repo: RepositorioAcompanhamento,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export { RepositorioAcompanhamentoMemoria };
