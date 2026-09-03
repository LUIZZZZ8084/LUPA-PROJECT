import { z } from "zod";
import { SERVICE_CATEGORIES } from "@/lib/constants";
import { onlyDigits } from "@/lib/format";
import { cpfValido, zTexto } from "../validation";

/**
 * O que a conta precisa informar para virar prestador.
 *
 * Os três primeiros são o que faz um anúncio existir: sem categoria
 * ninguém encontra, sem descrição ninguém entende o que a pessoa faz, e
 * sem CPF não há a quem responsabilizar. O preço fica opcional de
 * propósito — quem cobra por empreitada não tem um número inicial, e
 * exigir um inventado é pior do que não ter.
 */
export const schemaAtivacaoPrestador = z.object({
  /*
   * Chega com máscara da tela ("000.000.000-00") e é comparado por
   * dígitos: quem digita com ponto e quem digita sem são a mesma pessoa,
   * e guardar as duas formas faria o índice único parar de valer.
   */
  cpf: z
    .string()
    .transform(onlyDigits)
    .refine((d) => d.length === 11, "O CPF tem 11 dígitos.")
    .refine(cpfValido, "CPF inválido."),

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
