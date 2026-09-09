import "server-only";

import { clienteDeServico } from "@/lib/supabase/service";
import { erros } from "../errors";
import type {
  Assinatura,
  DadosCobrancaLiquidada,
  DadosNovaAssinatura,
  DadosNovaCobranca,
  Pagamento,
  RepositorioPagamentos,
  StatusAssinatura,
  StatusPagamento,
  TipoPagamento,
} from "./tipos";
import { STATUS_ASSINATURA_VIVA, STATUS_LIQUIDADOS } from "./tipos";

function paraPagamento(linha: Record<string, unknown>): Pagamento {
  return {
    id: String(linha.id),
    usuarioId: String(linha.usuario_id),
    tipo: linha.tipo as TipoPagamento,
    valorCentavos: Number(linha.valor_centavos),
    status: linha.status as StatusPagamento,
    mpPaymentId: (linha.mp_payment_id as string | null) ?? null,
    assinaturaId: (linha.assinatura_id as string | null) ?? null,
    metadata: (linha.metadata as Record<string, unknown> | null) ?? {},
    criadoEm: String(linha.criado_em),
    atualizadoEm: String(linha.atualizado_em),
  };
}

function paraAssinatura(linha: Record<string, unknown>): Assinatura {
  return {
    id: String(linha.id),
    usuarioId: String(linha.usuario_id),
    tipo: linha.tipo as TipoPagamento,
    valorCentavos: Number(linha.valor_centavos),
    status: linha.status as StatusAssinatura,
    mpPreapprovalId: (linha.mp_preapproval_id as string | null) ?? null,
    checkoutUrl: (linha.checkout_url as string | null) ?? null,
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

/** Violação de unicidade: a linha já existe. */
function ehDuplicado(erro: { code?: string }): boolean {
  return erro.code === "23505";
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
        assinatura_id: dados.assinaturaId ?? null,
        metadata: dados.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) throw erros.indisponivel(error.message);
    return paraPagamento(data);
  }

  /**
   * Quem garante a idempotência é o índice único de
   * `pagamentos.mp_payment_id`, não uma leitura antes da escrita.
   *
   * O Mercado Pago reenvia o aviso de cobrança recorrente, e duas
   * notificações chegando juntas passariam as duas por um `select`
   * anterior — e estenderiam 60 dias por uma cobrança só. Aqui a segunda
   * esbarra no índice, vira `23505`, e este método devolve `null`: o
   * chamador lê isso como "outro aviso já registrou esta parcela".
   */
  async registrarLiquidada(
    dados: DadosCobrancaLiquidada,
  ): Promise<Pagamento | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("pagamentos")
      .insert({
        usuario_id: dados.usuarioId,
        tipo: dados.tipo,
        valor_centavos: dados.valorCentavos,
        status: "aprovado",
        mp_payment_id: dados.mpPaymentId,
        assinatura_id: dados.assinaturaId ?? null,
        metadata: dados.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      if (ehDuplicado(error)) return null;
      throw erros.indisponivel(error.message);
    }
    return paraPagamento(data);
  }

  /** O índice único de `mp_payment_id` garante que só existe uma. */
  async porMpPaymentId(mpPaymentId: string): Promise<Pagamento | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("mp_payment_id", mpPaymentId)
      .maybeSingle();

    if (error) throw erros.indisponivel(error.message);
    return data ? paraPagamento(data) : null;
  }

  async ultimoAprovado(usuarioId: string): Promise<Pagamento | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("usuario_id", usuarioId)
      .eq("status", "aprovado")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw erros.indisponivel(error.message);
    return data ? paraPagamento(data) : null;
  }

  async contarLiquidadas(usuarioId: string): Promise<number> {
    const supabase = await cliente();
    const { count, error } = await supabase
      .from("pagamentos")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuarioId)
      .in("status", [...STATUS_LIQUIDADOS]);

    if (error) throw erros.indisponivel(error.message);
    return count ?? 0;
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

  async cancelar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return mudarStatusSePendente(id, "cancelado", mpPaymentId);
  }

  /**
   * Parte de `aprovado`, não de `pendente`.
   *
   * Estorno acontece depois de o dinheiro ter entrado. Usar a guarda de
   * `pendente` aqui recusaria a transição em silêncio — a cobrança
   * continuaria `aprovado`, o prestador continuaria na vitrine, e o
   * `null` devolvido seria lido como "outra notificação já resolveu".
   */
  async estornar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return mudarStatusSe(id, "aprovado", "estornado", mpPaymentId);
  }

  // ── Assinaturas recorrentes ───────────────────────────────────────────

  async assinaturaViva(usuarioId: string): Promise<Assinatura | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("usuario_id", usuarioId)
      .in("status", [...STATUS_ASSINATURA_VIVA])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw erros.indisponivel(error.message);
    return data ? paraAssinatura(data) : null;
  }

  async assinaturaPorId(id: string): Promise<Assinatura | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (ehIdInvalido(error)) return null;
      throw erros.indisponivel(error.message);
    }
    return data ? paraAssinatura(data) : null;
  }

  async assinaturaPorMpId(mpPreapprovalId: string): Promise<Assinatura | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("assinaturas")
      .select("*")
      .eq("mp_preapproval_id", mpPreapprovalId)
      .maybeSingle();

    if (error) throw erros.indisponivel(error.message);
    return data ? paraAssinatura(data) : null;
  }

  async criarAssinatura(dados: DadosNovaAssinatura): Promise<Assinatura> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("assinaturas")
      .insert({
        usuario_id: dados.usuarioId,
        tipo: dados.tipo,
        valor_centavos: dados.valorCentavos,
      })
      .select("*")
      .single();

    if (error) throw erros.indisponivel(error.message);
    return paraAssinatura(data);
  }

  async vincularAssinaturaAoMercadoPago(
    id: string,
    dados: { mpPreapprovalId: string; checkoutUrl: string | null },
  ): Promise<Assinatura> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("assinaturas")
      .update({
        mp_preapproval_id: dados.mpPreapprovalId,
        checkout_url: dados.checkoutUrl,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116" || ehIdInvalido(error)) {
        throw erros.naoEncontrado("Assinatura");
      }
      throw erros.indisponivel(error.message);
    }
    return paraAssinatura(data);
  }

  /**
   * As duas guardas moram na própria instrução, como toda troca de status
   * deste arquivo: `neq(status, novo)` porque aviso repetido não é
   * mudança, e `neq(status, 'cancelada')` porque cancelada é terminal —
   * um "autorizada" atrasado chegando depois do cancelamento
   * ressuscitaria uma assinatura que a pessoa encerrou.
   */
  async definirStatusAssinatura(
    id: string,
    status: StatusAssinatura,
  ): Promise<Assinatura | null> {
    const supabase = await cliente();
    const { data, error } = await supabase
      .from("assinaturas")
      .update({ status })
      .eq("id", id)
      .neq("status", status)
      .neq("status", "cancelada")
      .select("*")
      .maybeSingle();

    if (error) {
      if (ehIdInvalido(error)) throw erros.naoEncontrado("Assinatura");
      throw erros.indisponivel(error.message);
    }
    return data ? paraAssinatura(data) : null;
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
  return mudarStatusSe(id, "pendente", status, mpPaymentId);
}

async function mudarStatusSe(
  id: string,
  de: StatusPagamento,
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
    .eq("status", de)
    .select("*")
    .maybeSingle();

  if (error) {
    if (ehIdInvalido(error)) throw erros.naoEncontrado("Pagamento");
    throw erros.indisponivel(error.message);
  }
  return data ? paraPagamento(data) : null;
}
