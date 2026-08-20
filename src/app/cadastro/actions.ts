"use server";

import { z } from "zod";
import { PILOT_CITY } from "@/lib/constants";
import { onlyDigits } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

const base = {
  full_name: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "Use pelo menos 8 caracteres."),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length === 10 || v.length === 11, "Telefone inválido."),
  neighborhood: z.string().trim().optional(),
};

const schemas = {
  candidato_clt: z.object({
    ...base,
    desired_area: z.string().trim().min(1, "Escolha a área desejada."),
  }),
  prestador_servico: z.object({
    ...base,
    category_id: z.coerce.number().int().positive("Escolha uma categoria."),
    starting_price: z.coerce.number().nonnegative().optional(),
    description: z
      .string()
      .trim()
      .min(20, "Descreva seu serviço em pelo menos 20 caracteres."),
  }),
  empresa: z.object({
    ...base,
    company_name: z.string().trim().min(2, "Informe o nome da empresa."),
    cnpj: z
      .string()
      .transform(onlyDigits)
      .refine((v) => v.length === 14, "CNPJ deve ter 14 dígitos."),
  }),
} satisfies Record<Role, z.ZodType>;

export type SignUpState = {
  ok?: boolean;
  demo?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const role = String(formData.get("role") ?? "") as Role;
  const schema = schemas[role];
  if (!schema) return { error: "Escolha um tipo de conta." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  const values = parsed.data as z.infer<(typeof schemas)["candidato_clt"]> &
    Record<string, unknown>;

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        full_name: values.full_name,
        phone: values.phone,
        role,
        city: PILOT_CITY,
        neighborhood: values.neighborhood ?? null,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already"))
      return { error: "Já existe uma conta com este e-mail." };
    return { error: "Não foi possível criar a conta. Tente de novo." };
  }

  const userId = data.user?.id;
  if (!userId) return { ok: true };

  // O trigger handle_new_user cria a linha em `profiles`; aqui completamos
  // apenas a tabela específica do papel escolhido.
  if (role === "candidato_clt") {
    await supabase.from("clt_profiles").upsert({
      profile_id: userId,
      desired_area: String(raw.desired_area ?? ""),
    });
  } else if (role === "prestador_servico") {
    await supabase.from("provider_profiles").upsert({
      profile_id: userId,
      category_id: Number(raw.category_id),
      description: String(raw.description ?? ""),
      starting_price: raw.starting_price ? Number(raw.starting_price) : null,
    });
  } else if (role === "empresa") {
    await supabase.from("companies").upsert({
      profile_id: userId,
      company_name: String(raw.company_name ?? ""),
      cnpj: onlyDigits(String(raw.cnpj ?? "")),
    });
  }

  return { ok: true };
}
