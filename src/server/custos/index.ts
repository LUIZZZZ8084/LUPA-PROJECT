import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioCustosMemoria } from "./memoria";
import { RepositorioCustosPostgres } from "./postgres";
import type { RepositorioCustos } from "./tipos";

/*
 * Em demonstração a lista mora em `globalThis`, como as cobranças: a
 * action que salva um custo e a rota que o painel consulta a cada 15
 * segundos viram bundles diferentes no build, e um `Map` de módulo faria
 * o custo salvo sumir na atualização seguinte (ver AGENTS.md, "Repositório
 * em memória numa variável de módulo não atravessa bundles").
 */
const CHAVE = Symbol.for("lupa.custos.memoria");

type Global = typeof globalThis & {
  [CHAVE]?: RepositorioCustosMemoria;
};

function memoriaCompartilhada(): RepositorioCustosMemoria {
  const g = globalThis as Global;
  g[CHAVE] ??= new RepositorioCustosMemoria();
  return g[CHAVE];
}

let cache: RepositorioCustos | null = null;

export function repositorioCustos(): RepositorioCustos {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioCustosPostgres()
      : memoriaCompartilhada();
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioCustos(repo: RepositorioCustos): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export { RepositorioCustosMemoria };
