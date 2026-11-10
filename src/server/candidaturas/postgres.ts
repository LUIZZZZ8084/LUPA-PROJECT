import "server-only";

import {
  TETO_CANDIDATURAS,
  TETO_SERIE_DE_METRICAS,
} from "@/lib/limites-de-lista";
import { clienteDeServico } from "@/lib/supabase/service";
import { respostasValidas } from "@/lib/triagem";
import { erros } from "../errors";
import type {
  Candidatura,
  DadosNovaCandidatura,
  EventoDoHistorico,
  RepositorioCandidaturas,
  StatusCandidatura,
} from "./tipos";

/** Teto do histórico de uma candidatura: muito além do que um processo tem. */
const TETO_DO_HISTORICO = 200;

function paraEvento(linha: Record<string, unknown>): EventoDoHistorico {
  const base = {
    id: String(linha.id),
    candidaturaId: String(linha.candidatura_id),
    autorId: linha.autor_id ? String(linha.autor_id) : null,
    criadoEm: String(linha.criado_em),
  };
  return linha.tipo === "contato"
    ? { ...base, tipo: "contato", nota: String(linha.nota ?? "") }
    : {
        ...base,
        tipo: "etapa",
        de: linha.de as StatusCandidatura,
        para: linha.para as StatusCandidatura,
      };
}

function paraCandidatura(linha: Record<string, unknown>): Candidatura {
  return {
    id: String(linha.id),
    vagaId: String(linha.vaga_id),
    candidatoId: String(linha.candidato_id),
    status: linha.status as StatusCandidatura,
    criadoEm: String(linha.criado_em),
    respostas: respostasValidas(linha.respostas),
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
      .order("criado_em", { ascending: false })
      .limit(TETO_CANDIDATURAS);

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
      .order("criado_em", { ascending: false })
      .limit(TETO_CANDIDATURAS);

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
      .order("criado_em", { ascending: false })
      .limit(TETO_CANDIDATURAS);

    if (error) throw erros.indisponivel(error.message);
    return (data ?? []).map(paraCandidatura);
  }

  async criar(dados: DadosNovaCandidatura): Promise<Candidatura> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("candidaturas")
      .insert({
        vaga_id: dados.vagaId,
        candidato_id: dados.candidatoId,
        respostas: dados.respostas ?? null,
      })
      .select("*")
      .single();

    if (error) {
      // 23505 = índice único (vaga_id, candidato_id).
      if (error.code === "23505") {
        throw erros.conflito("Você já se candidatou a esta vaga.");
      }
      // 23514 = a trava do banco (`candidaturas_confere_triagem`): a vaga
      // tem perguntas e as respostas não vieram completas.
      if (error.code === "23514") {
        throw erros.validacao(
          [{ campo: "respostas", mensagem: "Responda a todas as perguntas." }],
          "Responda a todas as perguntas antes de enviar.",
        );
      }
      throw erros.indisponivel(error.message);
    }
    return paraCandidatura(data);
  }

  /**
   * `mover_candidatura` (#608) muda o estágio e grava o histórico na mesma
   * transação: um `update` e um `insert` separados deixariam candidatura
   * movida sem registro se o segundo falhasse. `setof candidaturas` devolve
   * zero ou uma linha; zero é "não existe".
   */
  async moverEstagio(
    id: string,
    status: StatusCandidatura,
    autorId: string | null,
  ): Promise<Candidatura> {
    const supabase = await cliente();
    const { data, error } = await supabase.rpc("mover_candidatura", {
      p_id: id,
      p_status: status,
      p_autor: autorId,
    });

    if (error) {
      if (ehIdInvalido(error)) throw erros.naoEncontrado("Candidatura");
      throw erros.indisponivel(error.message);
    }
    const linha = Array.isArray(data) ? data[0] : data;
    if (!linha) throw erros.naoEncontrado("Candidatura");
    return paraCandidatura(linha);
  }

  async historicoDe(candidaturaId: string): Promise<EventoDoHistorico[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("historico_candidatura")
      .select("*")
      .eq("candidatura_id", candidaturaId)
      .order("criado_em", { ascending: false })
      .limit(TETO_DO_HISTORICO);

    if (error) {
      if (ehIdInvalido(error)) return [];
      throw erros.indisponivel(error.message);
    }
    return (data ?? []).map(paraEvento);
  }

  async ultimasMovimentacoes(
    candidaturaIds: readonly string[],
  ): Promise<Map<string, string>> {
    // `in` com lista vazia é erro, e empresa sem candidatura não tem o que ler.
    if (candidaturaIds.length === 0) return new Map();

    const supabase = await cliente();
    const { data, error } = await supabase
      .from("historico_candidatura")
      .select("candidatura_id, criado_em")
      .in("candidatura_id", [...candidaturaIds])
      .order("criado_em", { ascending: false })
      .limit(TETO_SERIE_DE_METRICAS);

    if (error) throw erros.indisponivel(error.message);

    // Vem do mais recente para o mais antigo: a primeira de cada id vale.
    const ultimas = new Map<string, string>();
    for (const linha of data ?? []) {
      const id = String(linha.candidatura_id);
      if (!ultimas.has(id)) ultimas.set(id, String(linha.criado_em));
    }
    return ultimas;
  }
}
