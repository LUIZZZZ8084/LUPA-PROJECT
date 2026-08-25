import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioCandidaturasMemoria } from "./memoria";
import { RepositorioCandidaturasPostgres } from "./postgres";
import type { RepositorioCandidaturas } from "./tipos";

const memoria = new RepositorioCandidaturasMemoria();

let cache: RepositorioCandidaturas | null = null;

export function repositorioCandidaturas(): RepositorioCandidaturas {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioCandidaturasPostgres()
      : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioCandidaturas(
  repo: RepositorioCandidaturas,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioCandidaturas };
export { RepositorioCandidaturasMemoria };
