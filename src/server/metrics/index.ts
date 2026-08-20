import { isSupabaseConfigured } from "@/lib/supabase/config";
import { repositorioUsuariosMemoria } from "../repositories";
import { RepositorioMetricasMemoria } from "./memoria";
import { RepositorioMetricasPostgres } from "./postgres";
import type { RepositorioMetricas } from "./tipos";

let cache: RepositorioMetricas | null = null;

export function repositorioMetricas(): RepositorioMetricas {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioMetricasPostgres()
      : new RepositorioMetricasMemoria(repositorioUsuariosMemoria());
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioMetricas(repo: RepositorioMetricas): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioMetricas };
export { RepositorioMetricasMemoria };
