import { z } from "zod";
import {
  JOB_CATEGORIES,
  MAX_BAIRROS_ATENDIDOS,
  SERVICE_CATEGORIES,
} from "@/lib/constants";
import { zCelular, zNome, zNomeDeBairro, zTexto } from "../validation";

/**
 * O que se pode editar depois que a conta existe.
 *
 * O cadastro pede o mínimo para a conta existir e a pessoa ser encontrada;
 * o resto vem aqui, quando ela já viu que a plataforma tem gente de verdade.
 * A divisão é decisão de produto e está no AGENTS.md.
 *
 * Campo opcional aceita string vazia e vira `null`: um formulário HTML
 * manda `""` para campo em branco, e gravar `""` faria "não informado" e
 * "informado como nada" virarem a mesma coisa no banco.
 */

const vazioViraNulo = (v: unknown) => (v === "" ? null : v);

const zOpcional = (max: number, oQue: string) =>
  z.preprocess(
    vazioViraNulo,
    z.string().trim().max(max, `${oQue} longo demais.`).nullable(),
  );

/*
 * Bairro é texto, não enum.
 *
 * Era um `z.enum` dos 14 bairros de Sinop. Com o app aberto a Mato Grosso
 * inteiro, enum recusaria o cadastro de quem mora em qualquer outra cidade
 * — e continuaria recusando um bairro novo de Sinop, que em cidade do agro
 * aparece todo ano. A curadoria existe na tela, que oferece a lista onde
 * ela existe; o servidor garante o que importa para o dado não apodrecer:
 * tamanho e nada de string vazia disfarçada de bairro.
 */
const zBairro = z.preprocess(vazioViraNulo, zNomeDeBairro.nullable());

/** Comum a todos os papéis: mora em `usuarios`. */
export const schemaBasico = z.object({
  nomeCompleto: zNome,
  telefone: zCelular,
  bairro: zBairro,
});

/**
 * Habilidades chegam como texto separado por vírgula.
 *
 * Uma lista de campos ou um seletor de tags seria mais rígido e pior no
 * celular, que é onde este público está: a pessoa digita como fala. O
 * limite existe para o cartão não virar parede de texto.
 */
const zHabilidades = z.preprocess(
  (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v !== "string") return [];
    return v
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
  },
  z
    .array(z.string().max(40, "Habilidade longa demais."))
    .max(20, "No máximo 20 habilidades."),
);

export const schemaCandidato = z.object({
  areaDesejada: z.preprocess(vazioViraNulo, z.enum(JOB_CATEGORIES).nullable()),
  resumo: zOpcional(600, "O resumo"),
  formacao: zOpcional(200, "A formação"),
  habilidades: zHabilidades,
  disponibilidade: zOpcional(80, "A disponibilidade"),

  /*
   * Caixa de seleção não enviada no formulário chega ausente, não como
   * "false" — é assim que HTML funciona. Sem este preprocess, desmarcar a
   * opção não desligaria nada: o campo simplesmente não chegaria, e o
   * valor anterior sobreviveria.
   *
   * Para uma opção de privacidade, "não consegui desligar" é o pior
   * defeito possível.
   */
  visivelParaEmpresas: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

/**
 * Categoria e descrição são obrigatórias aqui, e não no resto.
 *
 * O perfil do prestador é o anúncio dele. Sem os dois ele não aparece na
 * busca, ninguém o encontra, e a conclusão dele é que a plataforma não
 * funciona.
 */
export const schemaPrestador = z.object({
  categoriaId: z.coerce
    .number()
    .int()
    .refine(
      (id) => SERVICE_CATEGORIES.some((c) => c.id === id),
      "Escolha uma categoria da lista.",
    ),
  descricao: zTexto(20, 1000, "A descrição"),
  precoInicial: z.preprocess(
    vazioViraNulo,
    z.coerce
      .number()
      .min(0, "Preço não pode ser negativo.")
      .max(100_000, "Preço fora do razoável.")
      .nullable(),
  ),
  anosExperiencia: z.preprocess(
    vazioViraNulo,
    z.coerce
      .number()
      .int()
      .min(0)
      .max(70, "Confira os anos de experiência.")
      .nullable(),
  ),
  bairrosAtendidos: z.preprocess(
    (v) =>
      (Array.isArray(v) ? v : v ? [v] : [])
        .map((b) => String(b).trim())
        .filter(Boolean),
    z
      .array(zNomeDeBairro)
      .max(
        MAX_BAIRROS_ATENDIDOS,
        `Escolha até ${MAX_BAIRROS_ATENDIDOS} bairros.`,
      ),
  ),
});

/** O CNPJ não está aqui: é âncora de identidade, não campo de perfil. */
export const schemaEmpresa = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(2, "Informe o nome da empresa.")
    .max(150, "Nome longo demais."),
  setor: zOpcional(80, "O setor"),
  porte: z.preprocess(
    vazioViraNulo,
    z.enum(["MEI", "Micro", "Pequena", "Média", "Grande"]).nullable(),
  ),
  site: z.preprocess(
    vazioViraNulo,
    z.union([z.url("Endereço de site inválido."), z.null()]),
  ),
  descricao: zOpcional(2000, "A descrição"),
});

export type DadosBasicos = z.infer<typeof schemaBasico>;
export type DadosCandidato = z.infer<typeof schemaCandidato>;
export type DadosPrestador = z.infer<typeof schemaPrestador>;
export type DadosEmpresa = z.infer<typeof schemaEmpresa>;
