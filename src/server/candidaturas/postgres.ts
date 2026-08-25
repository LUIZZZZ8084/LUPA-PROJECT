import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type {
  Candidatura,
  DadosNovaCandidatura,
  RepositorioCandidaturas,
  StatusCandidatura,
} from "./tipos";

function paraCandidatura(linha: Record<string, unknown>): Candidatura {
  return {
    id: String(linha.id),
    vagaId: String(linha.vaga_id),
    candidatoId: String(linha.candidato_id),
    status: linha.status as StatusCandidatura,
    criadoEm: String(linha.criado_em),
  };
}

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

function ehIdInvalido(erro: { code?: string }): boolean {
  return erro.code === "22P02";
}

export class RepositorioCandidaturasPostgres
  implements RepositorioCandidaturas
{
  async porId(id: string): Promise<Candidatura | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (ehIdInvalido(error)) return null;
      throw erros.indisponivel(error.message);
    }
    return data ? paraCandidatura(data) : null;
  }

  async porVaga(vagaId: string): Promise<Candidatura[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .select("*")
      .eq("vaga_id", vagaId)
      .order("criado_em", { ascending: false });

    if (error) {
      if (ehIdInvalido(error)) return [];
      throw erros.indisponivel(error.message);
    }
    return (data ?? []).map(paraCandidatura);
  }

  async porCandidato(candidatoId: string): Promise<Candidatura[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .select("*")
      .eq("candidato_id", candidatoId)
      .order("criado_em", { ascending: false });

    if (error) {
      if (ehIdInvalido(error)) return [];
      throw erros.indisponivel(error.message);
    }
    return (data ?? []).map(paraCandidatura);
  }

  async listar(): Promise<Candidatura[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .select("*")
      .order("criado_em", { ascending: false });

    if (error) throw erros.indisponivel(error.message);
    return (data ?? []).map(paraCandidatura);
  }

  async criar(dados: DadosNovaCandidatura): Promise<Candidatura> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .insert({ vaga_id: dados.vagaId, candidato_id: dados.candidatoId })
      .select("*")
      .single();

    if (error) {
      // 23505 = índice único (vaga_id, candidato_id).
      if (error.code === "23505") {
        throw erros.conflito("Você já se candidatou a esta vaga.");
      }
      throw erros.indisponivel(error.message);
    }
    return paraCandidatura(data);
  }

  async moverEstagio(
    id: string,
    status: StatusCandidatura,
  ): Promise<Candidatura> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116" || ehIdInvalido(error)) {
        throw erros.naoEncontrado("Candidatura");
      }
      throw erros.indisponivel(error.message);
    }
    return paraCandidatura(data);
  }
}
