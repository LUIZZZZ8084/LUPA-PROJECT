"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";

export type ReviewDecision = "aprovado" | "reprovado";

export type DecisionResult =
  | { ok: true; demo?: boolean }
  | { ok: false; error: string };

/**
 * Decisão manual sobre um pedido de verificação.
 *
 * Ao decidir, o arquivo do documento é removido do bucket privado: fica só o
 * status no perfil. É a política de retenção descrita nos requisitos de LGPD.
 */
export async function decideVerification(
  requestId: string,
  decision: ReviewDecision,
): Promise<DecisionResult> {
  /*
   * Esta ação é um endpoint por si só: o muro do `proxy.ts` guarda a rota
   * `/admin`, não a chamada. A checagem mora aqui, como em toda ação que
   * muda dado (#360) — quem não é admin não chega nem a ler o pedido.
   */
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "admin:decidir_verificacao")) {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const { data: request, error: loadError } = await supabase
    .from("pedidos_verificacao")
    .select("id, usuario_id, documento_path, selfie_path")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError || !request) {
    return { ok: false, error: "Pedido não encontrado." };
  }

  const { error: updateError } = await supabase
    .from("pedidos_verificacao")
    .update({ status: decision, decidido_em: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    return { ok: false, error: "Não foi possível salvar a decisão." };
  }

  await supabase
    .from("usuarios")
    .update({
      status_verificacao: decision,
      doc_verificado: decision === "aprovado",
    })
    .eq("id", request.usuario_id);

  // Retenção: as imagens só existem até a decisão.
  const paths = [request.documento_path, request.selfie_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length > 0) {
    await supabase.storage.from("verificacao").remove(paths);
  }

  revalidatePath("/admin");
  return { ok: true };
}
