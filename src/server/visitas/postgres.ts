import "server-only";

import { TETO_ADMIN } from "@/lib/limites-de-lista";
import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { PaginaContada, RepositorioVisitas, VisitasNoDia } from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/**
 * `visitas_pagina`, fechada para as duas chaves do navegador. O incremento
 * passa por `registrar_visita_pagina`, com `on conflict do update`: duas
 * visitas no mesmo segundo pelo caminho ler-somar-gravar perderiam uma.
 */
export class RepositorioVisitasPostgres implements RepositorioVisitas {
  async registrar(pagina: PaginaContada): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.rpc("registrar_visita_pagina", {
      p_pagina: pagina,
    });
    if (error) throw erros.indisponivel(`visita: ${error.message}`);
  }

  async porDia(pagina: PaginaContada, desde: string): Promise<VisitasNoDia[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("visitas_pagina")
      .select("dia, total")
      .eq("pagina", pagina)
      .gte("dia", desde)
      .limit(TETO_ADMIN);
    if (error) throw erros.indisponivel(`visitas: ${error.message}`);

    return (data ?? []).map((l) => ({
      dia: String(l.dia).slice(0, 10),
      total: Number(l.total),
    }));
  }
}
