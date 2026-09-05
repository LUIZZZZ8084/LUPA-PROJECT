import { z } from "zod";
import {
  CIDADE_INICIAL,
  JOB_CATEGORIES,
  MAX_BAIRROS_ATENDIDOS,
  SERVICE_CATEGORIES,
} from "@/lib/constants";
import {
  zBairro,
  zCelular,
  zCidade,
  zCnpj,
  zCpf,
  zEmail,
  zNome,
  zNomeDeBairro,
  zSenha,
  zTexto,
} from "../validation";

/**
 * Schemas de cadastro, um por papel.
 *
 * O que cada papel precisa informar é decisão de produto, não de tecnologia,
 * e está documentada em AGENTS.md. O princípio: pedir agora só o que é
 * necessário para a conta existir e para a pessoa ser encontrada. O resto
 * vai para a edição de perfil, depois.
 */

const base = {
  nomeCompleto: zNome,
  email: zEmail,
  senha: zSenha,
  telefone: zCelular,
  cidade: zCidade.default(CIDADE_INICIAL),
  bairro: zBairro,
};

/**
 * Trabalhador comum.
 *
 * Cadastro curto de propósito. É o público mais numeroso e o menos paciente
 * com formulário: quem está procurando emprego no celular, muitas vezes em
 * dado móvel limitado, abandona uma tela com quinze campos. Currículo,
 * experiência e formação entram depois, na edição de perfil, quando a pessoa
 * já viu que existem vagas de verdade aqui.
 *
 * O CPF é a exceção que fica: sem ele, uma pessoa física entra na
 * plataforma sem nenhum documento que a amarre a uma identidade real — a
 * mesma brecha que o CNPJ fecha para empresa. Fica de fora do formulário
 * de edição pelo mesmo motivo do CNPJ em `EdicaoEmpresa`: corrigir é caso
 * de suporte, não campo de tela.
 */
export const schemaCandidato = z.object({
  ...base,
  papel: z.literal("candidato_clt"),
  cpf: zCpf,
  areaDesejada: z.enum(JOB_CATEGORIES),
});

/**
 * Prestador de serviço.
 *
 * Precisa de mais no cadastro porque o perfil já nasce sendo o anúncio: sem
 * categoria e descrição, ninguém o encontra na busca e ele conclui que a
 * plataforma não funciona.
 *
 * O CPF aqui repete o de `schemaCandidato` em vez de só herdar de `base`
 * de propósito: quem entra direto como prestador nunca passava por
 * `virarPrestador`, que é onde o CPF vivia até aqui — cadastrar direto
 * era a brecha, não a exceção.
 */
export const schemaPrestador = z.object({
  ...base,
  papel: z.literal("prestador_servico"),
  cpf: zCpf,
  categoriaId: z.coerce
    .number()
    .int()
    .refine(
      (id) => SERVICE_CATEGORIES.some((c) => c.id === id),
      "Escolha uma categoria da lista.",
    ),
  descricao: zTexto(20, 1000, "A descrição"),
  precoInicial: z.coerce
    .number()
    .min(0, "Preço não pode ser negativo.")
    .max(100_000, "Preço fora do razoável.")
    .optional(),
  anosExperiencia: z.coerce
    .number()
    .int()
    .min(0)
    .max(70, "Confira os anos de experiência.")
    .optional(),
  bairrosAtendidos: z
    .union([z.string(), z.array(z.string())])
    .transform((v) =>
      (Array.isArray(v) ? v : [v]).map((b) => b.trim()).filter(Boolean),
    )
    .pipe(z.array(zNomeDeBairro).max(MAX_BAIRROS_ATENDIDOS))
    .optional(),
});

/**
 * Empresa — ou quem contrata sem ter aberto empresa.
 *
 * CNPJ validado por dígito verificador é o que separa uma empresa real de
 * alguém publicando vaga falsa — o risco mais concreto numa plataforma de
 * emprego, onde vaga falsa vira golpe de taxa de cadastro.
 *
 * `tipoDocumento` existe porque nem todo contratante tem CNPJ: produtor
 * rural e autônomo contratam ajudante sem ter aberto empresa. Decisão do
 * Luiz em 03/09/2026 (#138, que reaproveita a #129). O CNPJ fica opcional
 * aqui — se ele é obrigatório depende de `tipoDocumento`, e isso é
 * `servico.ts` quem decide, não o schema: um schema não consegue ficar
 * discriminado por `papel` *e* validar cruzado por outro campo ao mesmo
 * tempo.
 *
 * **O CPF, não.** Ele é obrigatório sempre, nos dois modos do rádio —
 * decisão do Luiz em 05/09/2026 (#150): "CNPJ é CNPJ, e CPF é CPF".
 * São perguntas diferentes e as duas precisam de resposta. O CNPJ diz se
 * *a empresa* existe e está ativa, e é o que separa vaga real de anúncio
 * falso; o CPF diz *quem responde pela conta* quando uma vaga vira
 * reclamação. Até aqui a empresa com CNPJ não informava pessoa nenhuma.
 *
 * Ele não fica em `perfis_empresa`, que a chave anônima lê — vai para
 * `usuarios`, junto com o hash de senha, pela mesma razão de sempre:
 * CNPJ é registro público, CPF não é.
 */
export const schemaEmpresa = z.object({
  ...base,
  papel: z.literal("empresa"),
  tipoDocumento: z.enum(["cnpj", "cpf"]).default("cnpj"),
  razaoSocial: z
    .string()
    .trim()
    .min(2, "Informe o nome.")
    .max(150, "Nome longo demais."),
  cnpj: z
    .union([zCnpj, z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  cpf: zCpf,
  setor: z.string().trim().max(80).optional(),
  porte: z.enum(["MEI", "Micro", "Pequena", "Média", "Grande"]).optional(),
  site: z
    .union([z.url("Endereço de site inválido."), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  descricao: zTexto(20, 2000, "A descrição").optional(),
});

/** União discriminada: o papel escolhe qual conjunto de campos vale. */
export const schemaCadastro = z.discriminatedUnion("papel", [
  schemaCandidato,
  schemaPrestador,
  schemaEmpresa,
]);

export type DadosCadastro = z.infer<typeof schemaCadastro>;

/**
 * Login.
 *
 * A senha aqui só exige presença. Aplicar a regra de comprimento no login
 * revelaria a política para quem está sondando, e recusaria a entrada de
 * quem tem uma senha antiga válida.
 */
export const schemaLogin = z.object({
  email: zEmail,
  senha: z.string().min(1, "Informe a senha."),
});

export type DadosLogin = z.infer<typeof schemaLogin>;
