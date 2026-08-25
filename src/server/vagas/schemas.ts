import { z } from "zod";
import { SINOP_NEIGHBORHOODS } from "@/lib/constants";
import { zTexto } from "../validation";

const zBairro = z
  .enum(SINOP_NEIGHBORHOODS)
  .optional()
  .or(z.literal("").transform(() => undefined));

const zSalario = z.coerce.number().nonnegative().optional();

/** Campos comuns a publicar e editar vaga. */
export const camposVaga = {
  titulo: zTexto(4, 120, "O cargo"),
  descricao: zTexto(30, 5000, "A descrição"),
  categoria: z.string().trim().min(1, "Escolha uma categoria."),
  tipoContrato: z.string().trim().min(1, "Escolha o tipo de contrato."),
  bairro: zBairro,
  salarioMin: zSalario,
  salarioMax: zSalario,
};

const refinoSalario = (v: { salarioMin?: number; salarioMax?: number }) =>
  !v.salarioMin || !v.salarioMax || v.salarioMax >= v.salarioMin;

export const schemaNovaVaga = z.object(camposVaga).refine(refinoSalario, {
  message: "O teto precisa ser maior que o piso.",
  path: ["salarioMax"],
});

export const schemaEdicaoVaga = z
  .object({ id: z.string().trim().min(1, "Vaga inválida."), ...camposVaga })
  .refine(refinoSalario, {
    message: "O teto precisa ser maior que o piso.",
    path: ["salarioMax"],
  });

export const schemaIdVaga = z.object({
  id: z.string().trim().min(1, "Vaga inválida."),
});
