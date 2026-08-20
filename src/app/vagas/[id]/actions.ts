"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ApplyResult =
  | { ok: true; demo?: boolean }
  | { ok: false; error: string };

/**
 * Candidatura a uma vaga CLT.
 *
 * Sem Supabase configurado, devolve `demo: true` — a interface mostra o
 * estado de sucesso para a demonstração, mas nada é gravado.
 */
export async function applyToJob(jobId: string): Promise<ApplyResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Entre na sua conta para se candidatar." };
  }

  const { error } = await supabase
    .from("applications")
    .insert({ job_id: jobId, candidate_id: user.id });

  if (error) {
    // Chave única (job_id, candidate_id): já existe candidatura.
    if (error.code === "23505") {
      return { ok: false, error: "Você já se candidatou a esta vaga." };
    }
    return { ok: false, error: "Não foi possível enviar. Tente de novo." };
  }

  revalidatePath(`/vagas/${jobId}`);
  return { ok: true };
}
