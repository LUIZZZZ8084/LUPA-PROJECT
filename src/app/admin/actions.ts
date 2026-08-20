"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const { data: request, error: loadError } = await supabase
    .from("verification_requests")
    .select("id, profile_id, document_path, selfie_path")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError || !request) {
    return { ok: false, error: "Pedido não encontrado." };
  }

  const { error: updateError } = await supabase
    .from("verification_requests")
    .update({ status: decision, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    return { ok: false, error: "Não foi possível salvar a decisão." };
  }

  await supabase
    .from("profiles")
    .update({
      verification_status: decision,
      doc_verified: decision === "aprovado",
    })
    .eq("id", request.profile_id);

  // Retenção: as imagens só existem até a decisão.
  const paths = [request.document_path, request.selfie_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length > 0) {
    await supabase.storage.from("verificacao").remove(paths);
  }

  revalidatePath("/admin");
  return { ok: true };
}
