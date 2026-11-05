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
  /*
   * Etiquetas (#545): chegam como texto separado por vírgula, o jeito que
   * funciona no celular. Viram minúsculas e sem espaço repetido, para
   * "Banco de talentos" e "banco de  talentos" serem a mesma no filtro, e
   * repetidas caem.
   */
  etiquetas: z
    .string()
    .optional()
    .transform((t) => [
      ...new Set(
        (t ?? "")
          .split(",")
          .map((e) => e.trim().replace(/\s+/g, " ").toLowerCase())
          .filter(Boolean),
      ),
    ])
    .refine((lista) => lista.length <= 5, "No máximo cinco etiquetas.")
    .refine(
      (lista) => lista.every((e) => e.length >= 2 && e.length <= 30),
      "Cada etiqueta tem de 2 a 30 letras.",
    ),
});
