import "server-only";

import { TETO_ADMIN } from "@/lib/limites-de-lista";
import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { CustoMensal, DadosDoCusto, RepositorioCustos } from "./tipos";

/**
 * Custos em Postgres, pela chave de serviço: `custos_mensais` é fechada
 * para as duas chaves públicas, como toda tabela de dado da empresa.
 */
function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

function deLinha(l: Record<string, unknown>): CustoMensal {
  return {
    id: String(l.id),
    nome: String(l.nome),
    centavos: Number(l.valor_centavos ?? 0),
  };
}

const COLUNAS = "id, nome, valor_centavos";

export class RepositorioCustosPostgres implements RepositorioCustos {
  async listar(): Promise<CustoMensal[]> {
    const { data, error } = await cliente()
      .from("custos_mensais")
      .select(COLUNAS)
      .order("ordem", { ascending: true })
      .limit(TETO_ADMIN);
    if (error) throw erros.indisponivel(`custos: ${error.message}`);
    return (data ?? []).map(deLinha);
  }

  async criar(dados: DadosDoCusto): Promise<CustoMensal> {
    const { data, error } = await cliente()
      .from("custos_mensais")
      .insert({ nome: dados.nome, valor_centavos: dados.centavos })
      .select(COLUNAS)
      .single();
    if (error || !data)
      throw erros.indisponivel(`criar custo: ${error?.message ?? "sem linha"}`);
    return deLinha(data);
  }

  async atualizar(
    id: string,
    dados: DadosDoCusto,
  ): Promise<CustoMensal | null> {
    const { data, error } = await cliente()
      .from("custos_mensais")
      .update({ nome: dados.nome, valor_centavos: dados.centavos })
      .eq("id", id)
      .select(COLUNAS)
      .maybeSingle();
    if (error) throw erros.indisponivel(`editar custo: ${error.message}`);
    return data ? deLinha(data) : null;
  }

  async remover(id: string): Promise<boolean> {
    const { data, error } = await cliente()
      .from("custos_mensais")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw erros.indisponivel(`remover custo: ${error.message}`);
    return (data ?? []).length > 0;
  }
}
