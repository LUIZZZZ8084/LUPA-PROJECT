import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import {
  diasAte,
  montarSerie,
  type PontoDaSerie,
  type RepositorioVisualizacoes,
} from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/**
 * A tabela e a função são fechadas para a chave anônima.
 *
 * O incremento passa por `registrar_visualizacao`, que faz `on conflict do
 * update` — duas visitas simultâneas pelo caminho ler-somar-gravar
 * perderiam uma contagem, e o banco é o único lugar onde essa corrida não
 * existe.
 */
export class RepositorioVisualizacoesPostgres
  implements RepositorioVisualizacoes
{
  async registrar(vagaId: string): Promise<void> {
    const supabase = await cliente();
    const { error } = await supabase.rpc("registrar_visualizacao", {
      p_vaga_id: vagaId,
    });

    /*
     * Falha ao contar não pode derrubar a página da vaga: quem abriu quer
     * ler a vaga, e a métrica é do outro lado. O erro sobe para o log pelo
     * chamador, que decide ignorar.
     */
    if (error) throw erros.indisponivel(`visualização: ${error.message}`);
  }

  async serieDaEmpresa(
    empresaId: string,
    dias: number,
  ): Promise<PontoDaSerie[]> {
    const supabase = await cliente();
    const desde = diasAte(new Date(), dias)[0];

    const vagas = await supabase
      .from("vagas")
      .select("id")
      .eq("empresa_id", empresaId);

    if (vagas.error) {
      throw erros.indisponivel(`vagas da empresa: ${vagas.error.message}`);
    }

    const ids = (vagas.data ?? []).map((v) => String(v.id));

    // Empresa sem vaga não tem série — e `in` com lista vazia é erro.
    if (ids.length === 0) {
      return montarSerie(diasAte(new Date(), dias), new Map(), new Map());
    }

    const [vis, cand] = await Promise.all([
      supabase
        .from("visualizacoes_vaga")
        .select("dia, total")
        .in("vaga_id", ids)
        .gte("dia", desde),
      supabase
        .from("candidaturas")
        .select("criado_em")
        .in("vaga_id", ids)
        .gte("criado_em", `${desde}T00:00:00.000Z`),
    ]);

    if (vis.error) {
      throw erros.indisponivel(`visualizações: ${vis.error.message}`);
    }
    if (cand.error) {
      throw erros.indisponivel(`candidaturas: ${cand.error.message}`);
    }

    /*
     * Somado aqui, e não por `group by` no banco: o PostgREST não agrupa
     * sem criar uma view para cada recorte, e o volume de uma empresa em
     * trinta dias cabe folgado na memória de uma requisição.
     */
    const visualizacoes = new Map<string, number>();
    for (const linha of vis.data ?? []) {
      const dia = String(linha.dia);
      visualizacoes.set(
        dia,
        (visualizacoes.get(dia) ?? 0) + Number(linha.total),
      );
    }

    const candidaturas = new Map<string, number>();
    for (const linha of cand.data ?? []) {
      const dia = String(linha.criado_em).slice(0, 10);
      candidaturas.set(dia, (candidaturas.get(dia) ?? 0) + 1);
    }

    return montarSerie(diasAte(new Date(), dias), visualizacoes, candidaturas);
  }
}
