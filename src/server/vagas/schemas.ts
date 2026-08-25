import { z } from "zod";
import { zBairro, zCidade, zTexto } from "../validation";

const zSalario = z.coerce.number().nonnegative().optional();

/** Campos comuns a publicar e editar vaga. */
export const camposVaga = {
  titulo: zTexto(4, 120, "O cargo"),
  descricao: zTexto(30, 5000, "A descrição"),
  categoria: z.string().trim().min(1, "Escolha uma categoria."),
  /*
   * A cidade é da vaga, não da empresa.
   *
   * Uma transportadora sediada em Sinop contrata motorista em Sorriso, e
   * quem procura emprego em Sorriso precisa achar essa vaga lá. Herdar a
   * cidade da empresa esconderia a vaga de quem ela interessa e a mostraria
   * para quem não pode ir.
   */
  cidade: zCidade,
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
