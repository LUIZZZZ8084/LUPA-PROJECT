import { isSupabaseConfigured } from "@/lib/supabase/config";
import { log } from "../logger";
import { RepositorioVisitasMemoria } from "./memoria";
import { RepositorioVisitasPostgres } from "./postgres";
import type { PaginaContada, RepositorioVisitas } from "./tipos";

/**
 * Em demonstração as visitas moram em `globalThis`: quem conta é a página
 * para empresas, e quem lê é o painel do admin e a rota do polling —
 * bundles diferentes no build de produção (a lição da #164).
 */
const CHAVE = Symbol.for("lupa.visitas.memoria");

type Global = typeof globalThis & {
  [CHAVE]?: RepositorioVisitasMemoria;
};

function memoriaCompartilhada(): RepositorioVisitasMemoria {
  const g = globalThis as Global;
  g[CHAVE] ??= new RepositorioVisitasMemoria();
  return g[CHAVE];
}

let cache: RepositorioVisitas | null = null;

export function repositorioVisitas(): RepositorioVisitas {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioVisitasPostgres()
      : memoriaCompartilhada();
  }
  return cache;
}

/**
 * Conta uma visita sem deixar a falha chegar na tela: quem abriu a página
 * quer ler a página, e o número é nosso.
 */
export async function contarVisita(pagina: PaginaContada): Promise<void> {
  try {
    await repositorioVisitas().registrar(pagina);
  } catch (e) {
    log.warn("não foi possível contar a visita", {
      acao: "pagina.visitar",
      erro: e instanceof Error ? e.message : String(e),
    });
  }
}

export type { RepositorioVisitas };
export { RepositorioVisitasMemoria };
