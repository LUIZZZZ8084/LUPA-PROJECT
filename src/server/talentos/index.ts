import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioTalentosMemoria } from "./memoria";
import { RepositorioTalentosPostgres } from "./postgres";
import type { RepositorioTalentos } from "./tipos";

let cache: RepositorioTalentos | null = null;

export function repositorioTalentos(): RepositorioTalentos {
  cache ??= isSupabaseConfigured
    ? new RepositorioTalentosPostgres()
    : new RepositorioTalentosMemoria();
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioTalentos(repo: RepositorioTalentos): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export { RepositorioTalentosMemoria };
