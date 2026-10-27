import { z } from "zod";
import { MAXIMO_DE_PERGUNTAS, type PerguntaDeTriagem } from "@/lib/triagem";
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

/*
 * As perguntas de triagem chegam do formulário como `pergunta1..3` e
 * `eliminatoria1..3` (#491), e viram uma lista só no fim do schema.
 *
 * Mesma regra do título: **não aceitam link**. A pergunta é texto de
 * terceiro que a Lupa mostra a quem tem conta, e cargo ou pergunta nunca
 * precisam de link — o lugar dele é a descrição. Em branco vale: pergunta
 * é opcional, e as preenchidas formam a lista na ordem em que vieram.
 */
const zPerguntaOpcional = z
  .string()
  .trim()
  .max(120, "A pergunta tem no máximo 120 letras.")
  .refine(
    (texto) => texto === "" || texto.length >= 5,
    "A pergunta está curta demais.",
  )
  .refine(
    (texto) => !PARECE_LINK.test(texto),
    "A pergunta não pode ter link. Se precisar, ponha na descrição.",
  )
  .optional();

/** Caixa de marcar: chega como "on" ou não chega — ausência é "não". */
const zMarcada = z.preprocess(
  (v) => v === "on" || v === "sim" || v === true,
  z.boolean(),
);

const camposDePergunta = {
  pergunta1: zPerguntaOpcional,
  pergunta2: zPerguntaOpcional,
  pergunta3: zPerguntaOpcional,
  eliminatoria1: zMarcada,
  eliminatoria2: zMarcada,
  eliminatoria3: zMarcada,
};

type EntradaDePerguntas = {
  pergunta1?: string;
  pergunta2?: string;
  pergunta3?: string;
  eliminatoria1: boolean;
  eliminatoria2: boolean;
  eliminatoria3: boolean;
};

/** As três perguntas do formulário, sem as em branco, na ordem escrita. */
function reunirPerguntas(e: EntradaDePerguntas): PerguntaDeTriagem[] {
  const lista = [
    { texto: e.pergunta1, eliminatoria: e.eliminatoria1 },
    { texto: e.pergunta2, eliminatoria: e.eliminatoria2 },
    { texto: e.pergunta3, eliminatoria: e.eliminatoria3 },
  ];
  return lista
    .filter((p): p is PerguntaDeTriagem => Boolean(p.texto))
    .slice(0, MAXIMO_DE_PERGUNTAS);
}

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

export const schemaNovaVaga = z
  .object({ ...camposVaga, ...camposDePergunta })
  .refine(refinoSalario, {
    message: "O teto precisa ser maior que o piso.",
    path: ["salarioMax"],
  })
  /*
   * Duas perguntas iguais seriam a mesma resposta pedida duas vezes — e, na
   * tela de quem se candidata, duas linhas que só um texto distingue.
   */
  .refine(
    (v) => {
      const textos = [v.pergunta1, v.pergunta2, v.pergunta3]
        .filter((t): t is string => Boolean(t))
        .map((t) => t.toLowerCase());
      return new Set(textos).size === textos.length;
    },
    { message: "As perguntas não podem se repetir.", path: ["pergunta2"] },
  )
  .transform(
    ({
      pergunta1,
      pergunta2,
      pergunta3,
      eliminatoria1,
      eliminatoria2,
      eliminatoria3,
      ...vaga
    }) => ({
      ...vaga,
      perguntas: reunirPerguntas({
        pergunta1,
        pergunta2,
        pergunta3,
        eliminatoria1,
        eliminatoria2,
        eliminatoria3,
      }),
    }),
  );

export const schemaEdicaoVaga = z
  .object({ id: z.string().trim().min(1, "Vaga inválida."), ...camposVaga })
  .refine(refinoSalario, {
    message: "O teto precisa ser maior que o piso.",
    path: ["salarioMax"],
  });

export const schemaIdVaga = z.object({
  id: z.string().trim().min(1, "Vaga inválida."),
});
