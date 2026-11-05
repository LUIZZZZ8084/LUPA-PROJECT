import "server-only";

import { TETO_CANDIDATURAS } from "@/lib/limites-de-lista";
import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type {
  Acompanhamento,
  DadosAcompanhamento,
  RepositorioAcompanhamento,
} from "./tipos";

/**
 * `timestamp` sem fuso volta como `2026-11-06T14:30:00`: a tela trabalha com
 * minuto, o formato do `datetime-local`, e os segundos sobram.
 */
function horaDeParede(valor: unknown): string | null {
  return typeof valor === "string" && valor ? valor.slice(0, 16) : null;
}

function paraAcompanhamento(linha: Record<string, unknown>): Acompanhamento {
  return {
    candidaturaId: String(linha.candidatura_id),
    anotacao: String(linha.anotacao ?? ""),
    entrevistaEm: horaDeParede(linha.entrevista_em),
    entrevistaLocal: (linha.entrevista_local as string | null) ?? null,
    etiquetas: (linha.etiquetas as string[] | null) ?? [],
    atualizadoEm: String(linha.atualizado_em),
  };
}

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

export class RepositorioAcompanhamentoPostgres
  implements RepositorioAcompanhamento
{
  async porCandidatura(candidaturaId: string): Promise<Acompanhamento | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("acompanhamento_candidatura")
      .select("*")
      .eq("candidatura_id", candidaturaId)
      .maybeSingle();

    if (error) {
      // Id sem forma de uuid não é erro de servidor: não há o que mostrar.
      if (error.code === "22P02") return null;
      throw erros.indisponivel(error.message);
    }
    return data ? paraAcompanhamento(data) : null;
  }

  async porCandidaturas(
    candidaturaIds: readonly string[],
  ): Promise<Acompanhamento[]> {
    if (candidaturaIds.length === 0) return [];
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("acompanhamento_candidatura")
      .select("*")
      .in("candidatura_id", [...candidaturaIds])
      // Os ids vêm de uma lista de candidaturas que já tem este teto.
      .limit(TETO_CANDIDATURAS);

    if (error) throw erros.indisponivel(error.message);
    return (data ?? []).map(paraAcompanhamento);
  }

  async salvar(dados: DadosAcompanhamento): Promise<Acompanhamento> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("acompanhamento_candidatura")
      .upsert(
        {
          candidatura_id: dados.candidaturaId,
          anotacao: dados.anotacao,
          entrevista_em: dados.entrevistaEm,
          entrevista_local: dados.entrevistaLocal,
          etiquetas: dados.etiquetas,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "candidatura_id" },
      )
      .select("*")
      .single();

    if (error) throw erros.indisponivel(error.message);
    return paraAcompanhamento(data);
  }
}
