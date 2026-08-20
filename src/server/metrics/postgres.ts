import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Papel } from "../auth/rbac";
import { erros } from "../errors";
import type {
  CadastrosPorDia,
  DistribuicaoLocal,
  RepositorioMetricas,
  Totais,
} from "./tipos";

/**
 * Métricas em Postgres.
 *
 * As agregações vêm de views (`metricas_*`, na migração 0003) em vez de
 * consultas montadas aqui. O painel recarrega a cada poucos segundos: deixar
 * o banco agregar e devolver dezenas de linhas é muito mais barato do que
 * trazer todos os usuários para somar em JavaScript.
 */

async function cliente() {
  const supabase = await createClient();
  if (!supabase) throw erros.indisponivel("Supabase não configurado");
  return supabase;
}

function papeisZerados(): Record<Papel, number> {
  return { candidato_clt: 0, prestador_servico: 0, empresa: 0, admin: 0 };
}

export class RepositorioMetricasPostgres implements RepositorioMetricas {
  async totais(): Promise<Totais> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("metricas_totais")
      .select("*")
      .maybeSingle();

    if (error) throw erros.indisponivel(`métricas totais: ${error.message}`);

    return {
      usuarios: Number(data?.usuarios ?? 0),
      candidatos: Number(data?.candidatos ?? 0),
      prestadores: Number(data?.prestadores ?? 0),
      empresas: Number(data?.empresas ?? 0),
      vagasAbertas: Number(data?.vagas_abertas ?? 0),
    };
  }

  async cadastrosPorDia(dias: number): Promise<CadastrosPorDia[]> {
    const supabase = await cliente();

    const desde = new Date();
    desde.setUTCDate(desde.getUTCDate() - (dias - 1));
    const desdeISO = desde.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("metricas_cadastros_por_dia")
      .select("*")
      .gte("dia", desdeISO)
      .order("dia", { ascending: true });

    if (error) throw erros.indisponivel(`métricas cadastros: ${error.message}`);

    // A view devolve uma linha por dia e papel; a série contínua é montada
    // aqui para que dia sem cadastro apareça como zero em vez de sumir.
    const porDia = new Map<string, CadastrosPorDia>();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dia = d.toISOString().slice(0, 10);
      porDia.set(dia, { dia, total: 0, porPapel: papeisZerados() });
    }

    for (const linha of data ?? []) {
      const dia = String(linha.dia).slice(0, 10);
      const registro = porDia.get(dia);
      if (!registro) continue;
      const papel = linha.papel as Papel;
      const total = Number(linha.total ?? 0);
      registro.total += total;
      registro.porPapel[papel] = total;
    }

    return [...porDia.values()];
  }

  async distribuicaoPorLocal(limite: number): Promise<DistribuicaoLocal[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("metricas_por_local")
      .select("*")
      .order("total", { ascending: false })
      .limit(limite);

    if (error) throw erros.indisponivel(`métricas locais: ${error.message}`);

    return (data ?? []).map((l) => ({
      cidade: String(l.cidade),
      bairro: (l.bairro as string | null) ?? null,
      total: Number(l.total ?? 0),
    }));
  }

  async planosDeEmpresa(): Promise<{ mensal: number; trial: number }> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("metricas_planos")
      .select("*")
      .maybeSingle();

    if (error) throw erros.indisponivel(`métricas de plano: ${error.message}`);

    return {
      mensal: Number(data?.mensal ?? 0),
      trial: Number(data?.trial ?? 0),
    };
  }
}
