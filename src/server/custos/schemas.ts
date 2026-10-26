import { z } from "zod";
import { zTexto } from "../validation";

/** R$ 100.000,00 por mês: acima disso é engano de digitação, não custo. */
const MAXIMO_CENTAVOS = 10_000_000;

/**
 * Um valor em reais, como se escreve no Brasil, em centavos (#473).
 *
 * "1.234,56", "1234,56", "300" e "R$ 133,00" valem. Sem vírgula, o ponto é
 * separador de milhar ("1.500" é mil e quinhentos), a não ser que venham
 * só um ou dois dígitos depois dele ("133.5", "133.50"): aí quem digitou
 * usou o ponto como vírgula, e ler como milhar transformaria R$ 133,50 em
 * R$ 13.350. Devolve `null` para o que não é número.
 */
export function reaisEmCentavos(texto: string): number | null {
  let limpo = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!limpo) return null;

  if (limpo.includes(",")) {
    limpo = limpo.replaceAll(".", "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(limpo)) {
    limpo = limpo.replaceAll(".", "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

const zValorEmReais = z
  .string()
  .trim()
  .min(1, "Diga o valor por mês.")
  .transform((texto, ctx) => {
    const centavos = reaisEmCentavos(texto);
    if (centavos === null) {
      ctx.addIssue({
        code: "custom",
        message: 'Escreva o valor em reais, como "300" ou "1.234,56".',
      });
      return z.NEVER;
    }
    if (centavos <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "O valor precisa ser maior que zero.",
      });
      return z.NEVER;
    }
    if (centavos > MAXIMO_CENTAVOS) {
      ctx.addIssue({
        code: "custom",
        message: "Até R$ 100.000,00 por mês.",
      });
      return z.NEVER;
    }
    return centavos;
  });

export const schemaNovoCusto = z.object({
  nome: zTexto(2, 60, "O nome"),
  valor: zValorEmReais,
});

export const schemaEdicaoDeCusto = schemaNovoCusto.extend({
  id: z.uuid("Custo inválido."),
});

export const schemaIdDeCusto = z.object({
  id: z.uuid("Custo inválido."),
});
