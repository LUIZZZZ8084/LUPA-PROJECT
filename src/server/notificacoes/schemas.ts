import { z } from "zod";
import { JOB_CATEGORIES } from "@/lib/constants";
import { zCidade } from "../validation";

/**
 * Entrada das actions de aviso (#48).
 *
 * A cidade passa pelo mesmo `zCidade` do resto do app — contra a lista do
 * IBGE, não um `z.string()` qualquer. Cidade digitada livre viraria "Sinop"
 * e "sinop" na mesma base, e o casamento com a vaga deixaria de acontecer:
 * a pessoa marcaria a preferência e não receberia nada, sem saber por quê.
 */
export const schemaPreferencia = z.object({
  cidade: zCidade,
  /** Vazio significa "todas as áreas" — é o padrão de quem quer tudo. */
  categoria: z
    .union([z.enum(JOB_CATEGORIES), z.literal("")])
    .optional()
    .transform((v) => v ?? ""),
});

/**
 * A inscrição do aparelho, como o navegador a devolve.
 *
 * Só o formato: quem é o dono vem da sessão, no serviço. Os limites de
 * tamanho existem para não aceitar corpo arbitrário numa tabela que nunca
 * é lida por humano — endpoint de push real tem algumas centenas de
 * caracteres.
 */
export const schemaInscricao = z.object({
  endpoint: z.url("Endereço de inscrição inválido.").max(1000),
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(256),
});
