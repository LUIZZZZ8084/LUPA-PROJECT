import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioNotificacoesMemoria } from "./memoria";
import { RepositorioNotificacoesPostgres } from "./postgres";
import type { RepositorioNotificacoes } from "./tipos";

const memoria = new RepositorioNotificacoesMemoria();

let cache: RepositorioNotificacoes | null = null;

export function repositorioNotificacoes(): RepositorioNotificacoes {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioNotificacoesPostgres()
      : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioNotificacoes(
  repo: RepositorioNotificacoes,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioNotificacoes };
export { RepositorioNotificacoesMemoria };
