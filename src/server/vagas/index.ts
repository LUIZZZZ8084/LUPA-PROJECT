import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioVagasMemoria } from "./memoria";
import { RepositorioVagasPostgres } from "./postgres";
import type { RepositorioVagas } from "./tipos";

const memoria = new RepositorioVagasMemoria();

let cache: RepositorioVagas | null = null;

export function repositorioVagas(): RepositorioVagas {
  if (!cache) {
    cache = isSupabaseConfigured ? new RepositorioVagasPostgres() : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioVagas(repo: RepositorioVagas): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioVagas };
export { RepositorioVagasMemoria };
