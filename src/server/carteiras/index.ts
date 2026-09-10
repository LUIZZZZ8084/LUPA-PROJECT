import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioCarteirasMemoria } from "./memoria";
import { RepositorioCarteirasPostgres } from "./postgres";
import type { RepositorioCarteiras } from "./tipos";

/**
 * A carteira em memória mora em `globalThis`, pela mesma razão do
 * repositório de pagamentos: server action e route handler viram bundles
 * diferentes no build de produção, e cada um receberia o próprio `Map`.
 *
 * Aqui isso morde de verdade: a action de publicar vaga consome crédito,
 * e o webhook do Mercado Pago credita. Em demonstração, sem estado
 * compartilhado, o crédito comprado nunca chegaria a quem publica.
 */
const CHAVE = Symbol.for("lupa.carteiras.memoria");

type Global = typeof globalThis & {
  [CHAVE]?: RepositorioCarteirasMemoria;
};

function memoriaCompartilhada(): RepositorioCarteirasMemoria {
  const g = globalThis as Global;
  g[CHAVE] ??= new RepositorioCarteirasMemoria();
  return g[CHAVE];
}

let cache: RepositorioCarteiras | null = null;

export function repositorioCarteiras(): RepositorioCarteiras {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioCarteirasPostgres()
      : memoriaCompartilhada();
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioCarteiras(
  repo: RepositorioCarteiras,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioCarteiras };
export { RepositorioCarteirasMemoria };
