import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioSuporteMemoria } from "./memoria";
import { RepositorioSuportePostgres } from "./postgres";
import type { RepositorioSuporte } from "./tipos";

const memoria = new RepositorioSuporteMemoria();

let cache: RepositorioSuporte | null = null;

export function repositorioSuporte(): RepositorioSuporte {
  if (!cache) {
    cache = isSupabaseConfigured ? new RepositorioSuportePostgres() : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioSuporte(repo: RepositorioSuporte): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioSuporte };
export { RepositorioSuporteMemoria };
