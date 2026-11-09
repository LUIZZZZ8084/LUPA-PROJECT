import { isSupabaseConfigured } from "@/lib/supabase/config";
import { log } from "../logger";
import { RepositorioContagensPrestadorMemoria } from "./memoria";
import { RepositorioContagensPrestadorPostgres } from "./postgres";
import type {
  EventoDoPerfil,
  RepositorioContagensPrestador,
  TotaisDoPerfil,
} from "./tipos";

/** A janela que o prestador vê: um mês, como o gráfico da empresa. */
export const DIAS_DOS_NUMEROS = 30;

let cache: RepositorioContagensPrestador | null = null;

export function repositorioContagensPrestador(): RepositorioContagensPrestador {
  cache ??= isSupabaseConfigured
    ? new RepositorioContagensPrestadorPostgres()
    : new RepositorioContagensPrestadorMemoria();
  return cache;
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioContagensPrestador(
  repo: RepositorioContagensPrestador,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

/**
 * Conta sem deixar a falha chegar na tela. Quem abriu o perfil quer ver o
 * perfil, e quem clicou quer chegar ao WhatsApp; o número é do outro lado
 * do balcão, e falhar nele vai para o log.
 */
export async function contarNoPerfil(
  prestadorId: string,
  evento: EventoDoPerfil,
): Promise<void> {
  try {
    await repositorioContagensPrestador().registrar(prestadorId, evento);
  } catch (e) {
    log.warn("não foi possível contar no perfil do prestador", {
      acao: `prestador.${evento}`,
      erro: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Os números do próprio perfil. O id vem da sessão, nunca de fora: um
 * parâmetro aqui deixaria ler o movimento do concorrente.
 */
export async function numerosDoMeuPerfil(
  usuarioId: string,
): Promise<TotaisDoPerfil> {
  return repositorioContagensPrestador().totais(usuarioId, DIAS_DOS_NUMEROS);
}

export type { EventoDoPerfil, TotaisDoPerfil };
export { RepositorioContagensPrestadorMemoria };
