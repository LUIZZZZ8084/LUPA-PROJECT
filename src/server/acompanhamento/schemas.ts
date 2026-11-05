import { z } from "zod";

/** O formato do `datetime-local`: dia e hora, sem fuso nem segundos. */
const HORA_DE_PAREDE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/*
 * Tudo opcional menos a candidatura: salvar só a anotação, só a entrevista,
 * ou apagar as duas (campos em branco) são três usos normais da mesma tela.
 */
export const schemaAcompanhamento = z.object({
  candidaturaId: z.string().trim().min(1, "Candidatura inválida."),
  anotacao: z
    .string()
    .trim()
    .max(2000, "A anotação tem no máximo 2000 letras.")
    .optional()
    .transform((t) => t ?? ""),
  entrevistaEm: z
    .string()
    .trim()
    .refine(
      (t) =>
        t === "" || (HORA_DE_PAREDE.test(t) && !Number.isNaN(Date.parse(t))),
      "Escolha o dia e a hora da entrevista.",
    )
    .optional()
    .transform((t) => t || null),
  entrevistaLocal: z
    .string()
    .trim()
    .max(200, "O local tem no máximo 200 letras.")
    .optional()
    .transform((t) => t || null),
});
