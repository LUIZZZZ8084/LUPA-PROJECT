import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import {
  type ExecucaoDeVarredura,
  type NomeDaVarredura,
  type RepositorioVarreduras,
  type ResumoDaVarredura,
  VARREDURAS,
} from "./tipos";

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/**
 * Uma linha por varredura em `execucoes_varredura`, fechada para as duas
 * chaves do navegador. São duas linhas para sempre: a tabela não cresce.
 */
export class RepositorioVarredurasPostgres implements RepositorioVarreduras {
  async registrar(
    nome: NomeDaVarredura,
    execucao: { ok: boolean; resumo: ResumoDaVarredura; em: string },
  ): Promise<void> {
    const supabase = await cliente();
    /*
     * A falha não manda `ultima_ok_em`: no `upsert` do PostgREST só as
     * colunas enviadas são reescritas no conflito, e o último sucesso
     * continua onde estava — é ele que diz se a varredura está atrasada.
     */
    const { error } = await supabase.from("execucoes_varredura").upsert(
      {
        nome,
        rodou_em: execucao.em,
        ok: execucao.ok,
        resumo: execucao.resumo,
        ...(execucao.ok ? { ultima_ok_em: execucao.em } : {}),
      },
      { onConflict: "nome" },
    );
    if (error) throw erros.indisponivel(`varredura: ${error.message}`);
  }

  async todas(): Promise<ExecucaoDeVarredura[]> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("execucoes_varredura")
      .select("nome, rodou_em, ok, resumo, ultima_ok_em")
      .limit(Object.keys(VARREDURAS).length);
    if (error) throw erros.indisponivel(`varreduras: ${error.message}`);

    return (data ?? []).map((l) => ({
      nome: l.nome as NomeDaVarredura,
      rodouEm: String(l.rodou_em),
      ok: Boolean(l.ok),
      resumo: (l.resumo ?? {}) as ResumoDaVarredura,
      ultimaOkEm: l.ultima_ok_em ? String(l.ultima_ok_em) : null,
    }));
  }
}
