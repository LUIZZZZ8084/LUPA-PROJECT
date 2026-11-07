import { isSupabaseConfigured } from "@/lib/supabase/config";
import { log } from "../logger";
import { RepositorioVarredurasMemoria } from "./memoria";
import { RepositorioVarredurasPostgres } from "./postgres";
import type {
  NomeDaVarredura,
  RepositorioVarreduras,
  ResumoDaVarredura,
} from "./tipos";

/**
 * Em demonstração o registro mora em `globalThis`: quem grava é a rota do
 * cron, e quem lê é a página e a rota do painel — bundles diferentes no
 * build de produção, cada um com o próprio módulo (a lição da #164).
 */
const CHAVE = Symbol.for("lupa.varreduras.memoria");

type Global = typeof globalThis & {
  [CHAVE]?: RepositorioVarredurasMemoria;
};

function memoriaCompartilhada(): RepositorioVarredurasMemoria {
  const g = globalThis as Global;
  g[CHAVE] ??= new RepositorioVarredurasMemoria();
  return g[CHAVE];
}

let cache: RepositorioVarreduras | null = null;

export function repositorioVarreduras(): RepositorioVarreduras {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioVarredurasPostgres()
      : memoriaCompartilhada();
  }
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioVarreduras(
  repo: RepositorioVarreduras,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

/**
 * Grava a execução sem deixar a falha mudar a resposta da varredura.
 *
 * O registro é o espelho do trabalho, não o trabalho: se o banco recusar a
 * gravação, a varredura já fez o que tinha de fazer, e devolver erro à
 * Vercel por causa do espelho só esconderia que ela deu certo.
 */
export async function registrarExecucao(
  nome: NomeDaVarredura,
  execucao: { ok: boolean; resumo: ResumoDaVarredura },
): Promise<void> {
  try {
    await repositorioVarreduras().registrar(nome, {
      ...execucao,
      em: new Date().toISOString(),
    });
  } catch (e) {
    log.warn("não foi possível registrar a varredura", {
      acao: "varredura.registrar",
      varredura: nome,
      erro: e instanceof Error ? e.message : String(e),
    });
  }
}

export type { RepositorioVarreduras };
export { RepositorioVarredurasMemoria };
