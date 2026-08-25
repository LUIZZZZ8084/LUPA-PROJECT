import { isSupabaseConfigured } from "@/lib/supabase/config";
import { log } from "../logger";
import { RepositorioVisualizacoesMemoria } from "./memoria";
import { RepositorioVisualizacoesPostgres } from "./postgres";
import type { PontoDaSerie, RepositorioVisualizacoes } from "./tipos";

const memoria = new RepositorioVisualizacoesMemoria();

let cache: RepositorioVisualizacoes | null = null;

export function repositorioVisualizacoes(): RepositorioVisualizacoes {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioVisualizacoesPostgres()
      : memoria;
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioVisualizacoes(
  repo: RepositorioVisualizacoes,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

/**
 * Conta uma visualização sem deixar a falha chegar na tela.
 *
 * Quem abriu a vaga quer ler a vaga; a métrica é do outro lado do balcão.
 * Se a contagem falhar, o certo é registrar no log e seguir — derrubar a
 * página por causa de um número no painel de outra pessoa seria trocar o
 * essencial pelo acessório.
 */
export async function contarVisualizacao(vagaId: string): Promise<void> {
  try {
    await repositorioVisualizacoes().registrar(vagaId);
  } catch (e) {
    log.warn("não foi possível contar a visualização", {
      acao: "vaga.visualizar",
      erro: e instanceof Error ? e.message : String(e),
    });
  }
}

export type { PontoDaSerie, RepositorioVisualizacoes };
export { RepositorioVisualizacoesMemoria };
