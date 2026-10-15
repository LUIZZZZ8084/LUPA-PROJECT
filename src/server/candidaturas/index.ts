import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioCandidaturasMemoria } from "./memoria";
import { RepositorioCandidaturasPostgres } from "./postgres";
import type { Candidatura, RepositorioCandidaturas } from "./tipos";

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

/**
 * As candidaturas em demonstração, para o funil do painel (#471). Com banco,
 * quem conta é a view `metricas_funil`, e isto devolve lista vazia.
 */
export function candidaturasEmMemoria(): Candidatura[] {
  const repo = repositorioCandidaturas();
  return repo instanceof RepositorioCandidaturasMemoria ? repo.todas() : [];
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
