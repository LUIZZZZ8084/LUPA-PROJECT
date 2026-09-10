import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import type { Papel } from "../auth/rbac";
import { erros } from "../errors";
import type {
  CadastrosPorDia,
  Caixa,
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

// As views de métrica leem usuarios, que é fechada para a chave anônima.
async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
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

  async caixa(): Promise<Caixa> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("metricas_caixa")
      .select("*")
      .maybeSingle();

    if (error) throw erros.indisponivel(`caixa: ${error.message}`);

    const entrouCentavos = Number(data?.entrou_centavos ?? 0);
    const estornadoCentavos = Number(data?.estornado_centavos ?? 0);
    const contestadoCentavos = Number(data?.contestado_centavos ?? 0);

    return {
      entrouCentavos,
      estornadoCentavos,
      contestadoCentavos,
      recorrenteCentavos: Number(data?.recorrente_centavos ?? 0),
      /*
       * O líquido é calculado aqui, e não na view, de propósito: é a
       * mesma conta nos dois repositórios, e uma subtração escrita duas
       * vezes em linguagens diferentes é uma chance a mais de divergir.
       * A view entrega as parcelas; quem soma é um lugar só.
       */
      liquidoCentavos: entrouCentavos - estornadoCentavos - contestadoCentavos,
      cobrancas: Number(data?.cobrancas ?? 0),
      contestacoes: Number(data?.contestacoes ?? 0),
    };
  }
}
