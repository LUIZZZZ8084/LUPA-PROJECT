"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PILOT_CITY } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().trim().min(4, "Informe o cargo da vaga."),
  description: z
    .string()
    .trim()
    .min(30, "Descreva a vaga com pelo menos 30 caracteres."),
  category: z.string().trim().min(1, "Escolha uma categoria."),
  contract_type: z.string().trim().min(1, "Escolha o tipo de contrato."),
  neighborhood: z.string().trim().optional(),
  salary_min: z.coerce.number().nonnegative().optional(),
  salary_max: z.coerce.number().nonnegative().optional(),
});

export type PublishState = {
  ok?: boolean;
  demo?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function publishJob(
  _prev: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    contract_type: formData.get("contract_type"),
    neighborhood: formData.get("neighborhood") || undefined,
    salary_min: formData.get("salary_min") || undefined,
    salary_max: formData.get("salary_max") || undefined,
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  const values = parsed.data;

  if (
    values.salary_min &&
    values.salary_max &&
    values.salary_min > values.salary_max
  ) {
    return {
      error: "Revise os campos destacados.",
      fieldErrors: {
        salary_max: "O teto precisa ser maior que o piso.",
      },
    };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Entre com a conta da empresa para publicar." };

  const { error } = await supabase.from("jobs").insert({
    company_id: user.id,
    title: values.title,
    description: values.description,
    category: values.category,
    contract_type: values.contract_type,
    city: PILOT_CITY,
    neighborhood: values.neighborhood ?? null,
    salary_min: values.salary_min ?? null,
    salary_max: values.salary_max ?? null,
    status: "aberta",
  });

  if (error) return { error: "Não foi possível publicar. Tente de novo." };

  revalidatePath("/empresa");
  revalidatePath("/vagas");
  return { ok: true };
}
