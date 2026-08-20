import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioPublicacoesMemoria } from "./memoria";
import { RepositorioPublicacoesPostgres } from "./postgres";
import type { RepositorioPublicacoes } from "./tipos";

const memoria = new RepositorioPublicacoesMemoria();

let cache: RepositorioPublicacoes | null = null;

export function repositorioPublicacoes(): RepositorioPublicacoes {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioPublicacoesPostgres()
      : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioPublicacoes(
  repo: RepositorioPublicacoes,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioPublicacoes };
export { RepositorioPublicacoesMemoria };
