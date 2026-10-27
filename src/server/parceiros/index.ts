import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioParceirosMemoria } from "./memoria";
import { RepositorioParceirosPostgres } from "./postgres";
import type { RepositorioParceiros } from "./tipos";

/*
 * Em demonstração a lista mora em `globalThis`, como os custos: a action
 * que autoriza e a página que lista viram bundles diferentes no build (ver
 * AGENTS.md, "Repositório em memória numa variável de módulo não atravessa
 * bundles").
 */
const CHAVE = Symbol.for("lupa.parceiros.memoria");

type Global = typeof globalThis & {
  [CHAVE]?: RepositorioParceirosMemoria;
};

function memoriaCompartilhada(): RepositorioParceirosMemoria {
  const g = globalThis as Global;
  g[CHAVE] ??= new RepositorioParceirosMemoria();
  return g[CHAVE];
}

let cache: RepositorioParceiros | null = null;

export function repositorioParceiros(): RepositorioParceiros {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioParceirosPostgres()
      : memoriaCompartilhada();
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioParceiros(
  repo: RepositorioParceiros,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export { RepositorioParceirosMemoria };
