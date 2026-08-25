import { z } from "zod";

export const ESTAGIOS_CANDIDATURA = [
  "enviada",
  "visualizada",
  "entrevista",
  "aprovada",
  "rejeitada",
] as const;

export const schemaMoverCandidatura = z.object({
  id: z.string().trim().min(1, "Candidatura inválida."),
  status: z.enum(ESTAGIOS_CANDIDATURA, "Estágio inválido."),
});
