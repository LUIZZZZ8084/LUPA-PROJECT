import { z } from "zod";
import { ehCidadeAtendida } from "@/lib/constants";
import { onlyDigits } from "@/lib/format";
import { type ErroCampo, erros } from "./errors";
import { falha, ok, type Resultado } from "./result";

/**
 * Validação de entrada.
 *
 * Regra do projeto: nada entra no servidor sem passar por aqui. A tela pode
 * validar também, para dar retorno rápido, mas a tela é do usuário — quem
 * decide o que é válido é o servidor.
 */

/* ============================================================
   Documentos brasileiros
   ============================================================ */

/**
 * CPF pelo dígito verificador.
 *
 * Não basta contar onze dígitos: "111.111.111-11" tem onze e é inválido.
 * Aceitar um CPF falso hoje significa não conseguir identificar a pessoa
 * depois, num produto cujo diferencial é justamente a verificação.
 */
export function cpfValido(entrada: string): boolean {
  const d = onlyDigits(entrada);
  if (d.length !== 11) return false;
  // Todos os dígitos iguais passam na conta, mas não existem.
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digito = (ateIndice: number, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < ateIndice; i++) {
      soma += Number(d[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9, 10) === Number(d[9]) && digito(10, 11) === Number(d[10]);
}

/** CNPJ pelo dígito verificador, mesma lógica com os pesos do formato. */
export function cnpjValido(entrada: string): boolean {
  const d = onlyDigits(entrada);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const digito = (ateIndice: number) => {
    const pesos =
      ateIndice === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ateIndice; i++) soma += Number(d[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

/**
 * Celular brasileiro.
 *
 * DDD de 11 a 99 e o nono dígito começando em 9 — celular no Brasil sempre
 * começa com 9 depois do DDD. Fixo não serve: o produto inteiro depende de
 * WhatsApp.
 */
export function celularValido(entrada: string): boolean {
  const d = onlyDigits(entrada).replace(/^55/, "");
  if (d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return d[2] === "9";
}

/* ============================================================
   Tipos Zod reutilizáveis
   ============================================================ */

export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe o e-mail.")
  .pipe(z.email("E-mail inválido."));

/**
 * Senha: mínimo de 10 caracteres, sem exigir símbolo nem maiúscula.
 *
 * Regra de composição empurra a pessoa para "Senha@123" e para o papelzinho
 * colado no monitor. Comprimento protege mais, e o público aqui inclui gente
 * digitando no celular. O teto de 200 evita ataque por senha gigante.
 */
export const zSenha = z
  .string()
  .min(10, "Use pelo menos 10 caracteres.")
  .max(200, "Senha longa demais.");

export const zNome = z
  .string()
  .trim()
  .min(3, "Informe o nome completo.")
  .max(120, "Nome longo demais.");

export const zCelular = z
  .string()
  .transform(onlyDigits)
  .refine(celularValido, "Informe um celular válido com DDD.");

export const zCnpj = z
  .string()
  .transform(onlyDigits)
  .refine(cnpjValido, "CNPJ inválido.");

/**
 * Cidade. Só município de Mato Grosso.
 *
 * A checagem é contra a lista do IBGE, e não um `z.string()` qualquer:
 * cidade digitada livre viraria "Sinop", "sinop" e "Sinop-MT" na mesma
 * base, e o filtro de cidade deixaria de agrupar — que é justamente o que
 * faz o app ser hiperlocal em vez de mais um mural de anúncios.
 */
export const zCidade = z
  .string()
  .trim()
  .refine(ehCidadeAtendida, "Escolha uma cidade de Mato Grosso.");

/**
 * Bairro.
 *
 * Onde a cidade tem lista curada (Sinop), a interface oferece a lista; o
 * servidor não exige que o valor esteja nela. Exigir travaria o cadastro
 * de quem mora num bairro novo, e bairro novo aparece antes de qualquer
 * lista ser atualizada — em cidade que cresce como as do agro, aparece
 * todo ano.
 *
 * O que o servidor garante é o que importa para o dado não apodrecer:
 * tamanho com limite e nada de string vazia disfarçada de bairro.
 */
export const zNomeDeBairro = z
  .string()
  .trim()
  .min(2, "Bairro curto demais.")
  .max(60, "Bairro longo demais.");

export const zBairro = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  zNomeDeBairro.optional(),
);

/** Texto livre com limite, para descrição e publicação. */
export const zTexto = (min: number, max: number, oQue: string) =>
  z
    .string()
    .trim()
    .min(min, `${oQue} precisa de pelo menos ${min} caracteres.`)
    .max(max, `${oQue} pode ter no máximo ${max} caracteres.`);

/* ============================================================
   Ponte entre Zod e a taxonomia de erro
   ============================================================ */

export function camposDoZod(erro: z.ZodError): ErroCampo[] {
  const vistos = new Set<string>();
  const campos: ErroCampo[] = [];

  for (const issue of erro.issues) {
    const campo = issue.path.map(String).join(".") || "_";
    // Só a primeira mensagem por campo: uma lista de cinco erros no mesmo
    // input não ajuda ninguém a corrigir.
    if (vistos.has(campo)) continue;
    vistos.add(campo);
    campos.push({ campo, mensagem: issue.message });
  }

  return campos;
}

/** Valida e devolve Resultado, em vez de lançar. */
export function validar<T>(
  schema: z.ZodType<T>,
  entrada: unknown,
): Resultado<T> {
  const parsed = schema.safeParse(entrada);
  if (parsed.success) return ok(parsed.data);
  return falha(erros.validacao(camposDoZod(parsed.error)));
}

/**
 * FormData para objeto simples.
 *
 * Campo repetido vira lista; arquivo é descartado, porque upload passa por
 * outro caminho com verificação de tipo e tamanho.
 */
export function objetoDoFormData(formData: FormData): Record<string, unknown> {
  const saida: Record<string, unknown> = {};

  for (const [chave, valor] of formData.entries()) {
    /*
     * Texto e arquivo passam; qualquer outra coisa é descartada.
     *
     * O envelope de action nunca registra os valores da entrada — só nomes
     * de campo em erro de validação —, então carregar um `File` aqui não
     * derrama conteúdo de arquivo no log. Se um dia a entrada passar a ser
     * registrada, este é o ponto que precisa mudar junto.
     */
    if (typeof valor !== "string" && !(valor instanceof File)) continue;

    if (chave in saida) {
      const atual = saida[chave];
      saida[chave] = Array.isArray(atual) ? [...atual, valor] : [atual, valor];
    } else {
      saida[chave] = valor;
    }
  }

  return saida;
}
