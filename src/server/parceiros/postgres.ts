import "server-only";

import { TETO_ADMIN } from "@/lib/limites-de-lista";
import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type { DadosDaParceria, Parceria, RepositorioParceiros } from "./tipos";

/**
 * Parcerias em Postgres, pela chave de serviço: `parceiros` é fechada para
 * as duas chaves públicas, como toda tabela de dado da empresa.
 */
function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

const COLUNAS =
  "id, email, nome, valido_ate, criado_em, encerrado_em, usuario_id, concedido_ate";

function deLinha(l: Record<string, unknown>): Parceria {
  const texto = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(l.id),
    email: String(l.email),
    nome: String(l.nome),
    validoAte: texto(l.valido_ate),
    criadoEm: String(l.criado_em),
    encerradoEm: texto(l.encerrado_em),
    usuarioId: texto(l.usuario_id),
    concedidoAte: texto(l.concedido_ate),
  };
}

export class RepositorioParceirosPostgres implements RepositorioParceiros {
  async listar(): Promise<Parceria[]> {
    const { data, error } = await cliente()
      .from("parceiros")
      .select(COLUNAS)
      .order("encerrado_em", { ascending: false, nullsFirst: true })
      .order("criado_em", { ascending: false })
      .limit(TETO_ADMIN);
    if (error) throw erros.indisponivel(`parceiros: ${error.message}`);
    return (data ?? []).map(deLinha);
  }

  async abertaPorEmail(email: string): Promise<Parceria | null> {
    const { data, error } = await cliente()
      .from("parceiros")
      .select(COLUNAS)
      .eq("email", email)
      .is("encerrado_em", null)
      .maybeSingle();
    if (error) throw erros.indisponivel(`parceria: ${error.message}`);
    return data ? deLinha(data) : null;
  }

  async porId(id: string): Promise<Parceria | null> {
    const { data, error } = await cliente()
      .from("parceiros")
      .select(COLUNAS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw erros.indisponivel(`parceria: ${error.message}`);
    return data ? deLinha(data) : null;
  }

  async criar(
    dados: DadosDaParceria,
    criadoPor: string | null,
  ): Promise<Parceria> {
    const { data, error } = await cliente()
      .from("parceiros")
      .insert({
        email: dados.email,
        nome: dados.nome,
        valido_ate: dados.validoAte,
        criado_por: criadoPor,
      })
      .select(COLUNAS)
      .single();
    if (error || !data) {
      throw erros.indisponivel(
        `criar parceria: ${error?.message ?? "sem linha"}`,
      );
    }
    return deLinha(data);
  }

  async registrarConcessao(
    id: string,
    usuarioId: string,
    concedidoAte: string,
  ): Promise<void> {
    const { error } = await cliente()
      .from("parceiros")
      .update({
        usuario_id: usuarioId,
        concedido_ate: concedidoAte,
        concedido_em: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw erros.indisponivel(`concessão: ${error.message}`);
  }

  async encerrar(id: string): Promise<Parceria | null> {
    const { data, error } = await cliente()
      .from("parceiros")
      .update({ encerrado_em: new Date().toISOString() })
      .eq("id", id)
      .is("encerrado_em", null)
      .select(COLUNAS)
      .maybeSingle();
    if (error) throw erros.indisponivel(`encerrar parceria: ${error.message}`);
    return data ? deLinha(data) : null;
  }
}
