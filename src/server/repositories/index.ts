import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioMemoria } from "./memoria";
import { RepositorioPostgres } from "./postgres";
import type { RepositorioUsuarios } from "./tipos";

/**
 * Escolhe a implementação conforme o ambiente.
 *
 * Com Supabase configurado, Postgres. Sem, memória — o que mantém o modo
 * demonstração funcionando de ponta a ponta, inclusive criar conta e entrar.
 *
 * O repositório em memória é um singleton de módulo: dentro da mesma
 * instância serverless, o cadastro feito numa requisição é visto na
 * seguinte; entre instâncias, não. É o suficiente para demonstrar, e o nome
 * da classe não promete mais do que isso.
 */

const memoria = new RepositorioMemoria();

let cache: RepositorioUsuarios | null = null;

export function repositorioUsuarios(): RepositorioUsuarios {
  if (!cache) {
    cache = isSupabaseConfigured ? new RepositorioPostgres() : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorio(repo: RepositorioUsuarios): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioUsuarios };
export { RepositorioMemoria };
