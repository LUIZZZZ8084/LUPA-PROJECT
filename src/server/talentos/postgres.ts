import "server-only";

import { TETO_DO_DONO } from "@/lib/limites-de-lista";
import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { RepositorioTalentos } from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/** Tabela só da chave de serviço, como as anotações da empresa. */
export class RepositorioTalentosPostgres implements RepositorioTalentos {
  async salvar(empresaId: string, candidatoId: string): Promise<void> {
    const supabase = await cliente();
    // Salvar quem já está salvo não é erro: o botão pode chegar duas vezes.
    const { error } = await supabase
      .from("talentos_salvos")
      .upsert(
        { empresa_id: empresaId, candidato_id: candidatoId },
        { onConflict: "empresa_id,candidato_id", ignoreDuplicates: true },
      );
    if (error) throw erros.indisponivel(`talento: ${error.message}`);
  }

  async remover(empresaId: string, candidatoId: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase
      .from("talentos_salvos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("candidato_id", candidatoId);
    if (error) throw erros.indisponivel(`talento: ${error.message}`);
  }

  async salvosDa(empresaId: string): Promise<Set<string>> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("talentos_salvos")
      .select("candidato_id")
      .eq("empresa_id", empresaId)
      .limit(TETO_DO_DONO);
    if (error) throw erros.indisponivel(`talento: ${error.message}`);
    return new Set((data ?? []).map((l) => String(l.candidato_id)));
  }
}
