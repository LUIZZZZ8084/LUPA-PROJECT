import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type {
  DadosNovaCobranca,
  Pagamento,
  RepositorioPagamentos,
  StatusPagamento,
  TipoPagamento,
} from "./tipos";

function paraPagamento(linha: Record<string, unknown>): Pagamento {
  return {
    id: String(linha.id),
    usuarioId: String(linha.usuario_id),
    tipo: linha.tipo as TipoPagamento,
    valorCentavos: Number(linha.valor_centavos),
    status: linha.status as StatusPagamento,
    mpPreferenceId: (linha.mp_preference_id as string | null) ?? null,
    mpPaymentId: (linha.mp_payment_id as string | null) ?? null,
    metadata: (linha.metadata as Record<string, unknown> | null) ?? {},
    criadoEm: String(linha.criado_em),
    atualizadoEm: String(linha.atualizado_em),
  };
}

async function cliente() {
  const supabase = clienteDeServico();
  if (!supabase) throw erros.indisponivel("chave de serviço não configurada");
  return supabase;
}

/** Id sem forma de uuid não é erro de servidor — é "não encontrado". */
function ehIdInvalido(erro: { code?: string }): boolean {
  return erro.code === "22P02";
}

export class RepositorioPagamentosPostgres implements RepositorioPagamentos {
  async porId(id: string): Promise<Pagamento | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (ehIdInvalido(error)) return null;
      throw erros.indisponivel(error.message);
    }
    return data ? paraPagamento(data) : null;
  }

  async criar(dados: DadosNovaCobranca): Promise<Pagamento> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("pagamentos")
      .insert({
        usuario_id: dados.usuarioId,
        tipo: dados.tipo,
        valor_centavos: dados.valorCentavos,
        metadata: dados.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) throw erros.indisponivel(error.message);
    return paraPagamento(data);
  }

  async definirPreferencia(
    id: string,
    mpPreferenceId: string,
  ): Promise<Pagamento> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("pagamentos")
      .update({ mp_preference_id: mpPreferenceId })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116" || ehIdInvalido(error)) {
        throw erros.naoEncontrado("Pagamento");
      }
      throw erros.indisponivel(error.message);
    }
    return paraPagamento(data);
  }

  async aprovar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return mudarStatusSePendente(id, "aprovado", mpPaymentId);
  }

  async rejeitar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return mudarStatusSePendente(id, "rejeitado", mpPaymentId);
  }
}

/**
 * A troca de status é condicional na própria instrução —
 * `.eq("status", "pendente")` — não "lê, decide, grava" em dois passos:
 * o Mercado Pago reenvia webhook, e duas notificações chegando ao mesmo
 * tempo não podem aplicar o efeito (estender mensalidade, por exemplo)
 * duas vezes. `maybeSingle` porque zero linhas é resultado esperado
 * quando outra notificação já resolveu esta antes.
 */
async function mudarStatusSePendente(
  id: string,
  status: StatusPagamento,
  mpPaymentId: string | null,
): Promise<Pagamento | null> {
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("pagamentos")
    .update({
      status,
      ...(mpPaymentId !== null ? { mp_payment_id: mpPaymentId } : {}),
    })
    .eq("id", id)
    .eq("status", "pendente")
    .select("*")
    .maybeSingle();

  if (error) {
    if (ehIdInvalido(error)) throw erros.naoEncontrado("Pagamento");
    throw erros.indisponivel(error.message);
  }
  return data ? paraPagamento(data) : null;
}
