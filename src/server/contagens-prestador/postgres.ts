import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import {
  type EventoDoPerfil,
  inicioDaJanela,
  type RepositorioContagensPrestador,
  type TotaisDoPerfil,
} from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/**
 * Tabela e função fechadas para as chaves do navegador. O incremento passa
 * por `registrar_contagem_prestador`, com `on conflict do update`: duas
 * visitas simultâneas pelo caminho ler-somar-gravar perderiam uma.
 */
export class RepositorioContagensPrestadorPostgres
  implements RepositorioContagensPrestador
{
  async registrar(prestadorId: string, evento: EventoDoPerfil): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.rpc("registrar_contagem_prestador", {
      p_prestador: prestadorId,
      p_evento: evento,
    });
    if (error) throw erros.indisponivel(`contagem do perfil: ${error.message}`);
  }

  async totais(prestadorId: string, dias: number): Promise<TotaisDoPerfil> {
    const supabase = await cliente();
    // Uma linha por dia: a janela inteira cabe numa requisição.
    const { data, error } = await supabase
      .from("contagens_prestador")
      .select("visitas, contatos")
      .eq("prestador_id", prestadorId)
      .gte("dia", inicioDaJanela(new Date(), dias))
      .limit(dias);

    if (error) throw erros.indisponivel(`contagem do perfil: ${error.message}`);
    return (data ?? []).reduce<TotaisDoPerfil>(
      (acc, l) => ({
        visitas: acc.visitas + Number(l.visitas),
        contatos: acc.contatos + Number(l.contatos),
      }),
      { visitas: 0, contatos: 0 },
    );
  }
}
