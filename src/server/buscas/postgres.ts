import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { OndeBuscou, RepositorioBuscas, TermoSemResultado } from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

export class RepositorioBuscasPostgres implements RepositorioBuscas {
  /**
   * Incremento pela função, com `on conflict do update`.
   *
   * Duas pessoas buscando o mesmo termo no mesmo segundo pelo caminho
   * ler-somar-gravar perderiam uma contagem — e num termo raro, que é
   * justamente o que interessa aqui, perder uma é perder metade do sinal.
   */
  async registrar(termo: string, onde: OndeBuscou): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.rpc("registrar_busca_sem_resultado", {
      p_termo: termo,
      p_onde: onde,
    });

    if (error)
      throw erros.indisponivel(`busca sem resultado: ${error.message}`);
  }

  async maisBuscados(
    dias: number,
    limite: number,
  ): Promise<TermoSemResultado[]> {
    const supabase = await cliente();

    const desde = new Date();
    desde.setUTCDate(desde.getUTCDate() - (dias - 1));

    const { data, error } = await supabase
      .from("buscas_sem_resultado")
      .select("termo, total")
      .gte("dia", desde.toISOString().slice(0, 10));

    if (error) {
      throw erros.indisponivel(`buscas sem resultado: ${error.message}`);
    }

    /*
     * Somado aqui, e não por `group by`: o PostgREST não agrupa sem criar
     * uma view para cada recorte, e o volume de um mês de termos numa
     * cidade cabe folgado na memória de uma requisição.
     */
    const somados = new Map<string, number>();
    for (const linha of data ?? []) {
      const termo = String(linha.termo);
      somados.set(termo, (somados.get(termo) ?? 0) + Number(linha.total));
    }

    return [...somados.entries()]
      .map(([termo, total]) => ({ termo, total }))
      .sort(
        (a, b) => b.total - a.total || a.termo.localeCompare(b.termo, "pt-BR"),
      )
      .slice(0, limite);
  }
}
