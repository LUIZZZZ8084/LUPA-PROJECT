import { z } from "zod";

export const ESTAGIOS_CANDIDATURA = [
  "enviada",
  "visualizada",
  "contatada",
  "entrevista",
  "aprovada",
  "contratada",
  "rejeitada",
] as const;

export const schemaMoverCandidatura = z.object({
  id: z.string().trim().min(1, "Candidatura inválida."),
  status: z.enum(ESTAGIOS_CANDIDATURA, "Estágio inválido."),
});
