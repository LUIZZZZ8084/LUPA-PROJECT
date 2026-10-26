import { z } from "zod";
import { zBairro, zCidade, zTexto } from "../validation";

/**
 * O que a vaga pede, como texto separado por vírgula.
 *
 * Mesmo formato das habilidades do candidato, de propósito: é o que casa
 * um com o outro, e é o jeito que funciona no celular — a pessoa digita
 * como fala, em vez de caçar itens numa lista de duzentos.
 *
 * Opcional. Vaga sem habilidade declarada casa pelo título e pela
 * descrição, senão a recomendação só existiria depois de alguém preencher
 * um campo cujo resultado nunca viu.
 */
const zHabilidades = z.preprocess(
  (v) => {
    const bruto = Array.isArray(v)
      ? v.join(",")
      : typeof v === "string"
        ? v
        : "";
    return bruto
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
  },
  z
    .array(z.string().max(40, "Habilidade longa demais."))
    .max(20, "No máximo 20 habilidades."),
);

const zSalario = z.coerce.number().nonnegative().optional();

/*
 * O título vai no aviso de vaga nova (#48), para até 500 pessoas, numa
 * notificação que aparece como sendo da Lupa (#447). Cargo nunca precisa
 * de link, e o lugar dele é a descrição. O domínio é reconhecido pelo fim
 * conhecido, seguido de algo que não é letra — "Aux. de produção", "T.I." e
 * "Aux.comércio" passam; `\b` sozinho tomaria o "é" por fim de palavra.
 */
const PARECE_LINK =
  /https?:\/\/|www\.|[\p{L}\p{N}-]+\.(?:com|net|org|br|info|io|app|site|online|xyz|me|co|biz|top|link|shop|store|club|vip|ly|gl)(?![\p{L}\p{N}])/iu;

/** Campos comuns a publicar e editar vaga. */
export const camposVaga = {
  titulo: zTexto(4, 120, "O cargo").refine(
    (titulo) => !PARECE_LINK.test(titulo),
    "O cargo não pode ter link. Se precisar, ponha na descrição.",
  ),
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
  /*
   * Obrigatória em vaga nova (#300). Quem procura emprego decide pelo card
   * se dá para ir até lá todo dia — e, com o app aberto ao Brasil inteiro,
   * uma vaga home office em outra cidade passa a ser para ele também.
   */
  modalidade: z.enum(
    ["presencial", "home_office", "hibrido"],
    "Escolha se é presencial, home office ou híbrido.",
  ),
  /*
   * Obrigatória e sem resposta de antemão (#456): a empresa diz se a vaga
   * é para pessoa com deficiência (PCD), e quem procura filtra por isso.
   * Chega como "sim" ou "nao" porque um checkbox desmarcado é ausência —
   * e ausência não é resposta.
   */
  paraPcd: z
    .enum(["sim", "nao"], "Diga se a vaga é para pessoa com deficiência (PCD).")
    .transform((v) => v === "sim"),
  bairro: zBairro,
  /*
   * Aditivo ao bairro, não substituto: informa onde é de verdade — rua,
   * número, referência —, mas nunca decide o ranking de proximidade, que
   * continua olhando só bairro e cidade.
   */
  endereco: zTexto(5, 200, "O endereço"),
  habilidades: zHabilidades,
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
