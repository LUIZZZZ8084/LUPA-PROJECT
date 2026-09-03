import { z } from "zod";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { onlyDigits } from "@/lib/format";
import { cpfValido, zTexto } from "../validation";

/**
 * O que a conta precisa informar para virar prestador.
 *
 * Categoria e descrição são o que faz um anúncio existir: sem categoria
 * ninguém encontra, sem descrição ninguém entende o que a pessoa faz. O
 * preço fica opcional de propósito — quem cobra por empreitada não tem um
 * número inicial, e exigir um inventado é pior do que não ter.
 */
export const schemaAtivacaoPrestador = z.object({
  /*
   * Opcional porque quem se cadastrou depois do CPF virar obrigatório já
   * tem um em `usuarios` — o formulário nem mostra o campo, e o serviço
   * usa o que já está gravado. Só quem se cadastrou antes disso manda um
   * valor aqui, e `virarPrestador` é quem exige presença nesse caso.
   *
   * Chega com máscara da tela ("000.000.000-00") e é comparado por
   * dígitos: quem digita com ponto e quem digita sem são a mesma pessoa,
   * e guardar as duas formas faria o índice único parar de valer.
   */
  cpf: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .string()
      .transform(onlyDigits)
      .refine((d) => d.length === 11, "O CPF tem 11 dígitos.")
      .refine(cpfValido, "CPF inválido.")
      .optional(),
  ),

  categoriaId: z.coerce
    .number()
    .int()
    .refine(
      (id) => SERVICE_CATEGORIES.some((c) => c.id === id),
      "Escolha uma categoria da lista.",
    ),

  descricao: zTexto(20, 1000, "A descrição"),

  precoInicial: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce
      .number()
      .min(0, "Preço não pode ser negativo.")
      .max(100_000, "Preço fora do razoável.")
      .nullable(),
  ),
});
