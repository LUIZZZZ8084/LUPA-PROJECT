import "server-only";

import { TETO_ADMIN } from "@/lib/limites-de-lista";
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

  /**
   * O ranking vem somado e ordenado da view (#585). Somar aqui depois de
   * ler um teto de linhas sem ordem fazia o ranking sair de uma amostra
   * qualquer quando o mês passava do teto. A janela é a da view, 30 dias.
   */
  async maisBuscados(
    _dias: number,
    limite: number,
  ): Promise<TermoSemResultado[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("metricas_buscas_sem_resultado")
      .select("termo, total")
      .order("total", { ascending: false })
      .order("termo", { ascending: true })
      .limit(Math.min(limite, TETO_ADMIN));

    if (error) {
      throw erros.indisponivel(`buscas sem resultado: ${error.message}`);
    }

    return (data ?? []).map((l) => ({
      termo: String(l.termo),
      total: Number(l.total),
    }));
  }
}
