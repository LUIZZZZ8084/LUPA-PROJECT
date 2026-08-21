import "server-only";

import type { z } from "zod";
import { type AppError, comoAppError } from "./errors";
import { cronometro, log, novoRequestId } from "./logger";
import { objetoDoFormData, validar } from "./validation";

/**
 * Envelope de toda server action.
 *
 * Existe para que três coisas aconteçam sempre, sem depender de alguém
 * lembrar:
 *
 * 1. A entrada é validada por Zod antes de tocar em qualquer lógica.
 * 2. Nenhuma exceção escapa para a interface — o retorno é sempre o mesmo
 *    formato, com mensagem em português e um identificador para o suporte.
 * 3. Cada chamada deixa uma linha de log com ação, duração e resultado.
 *
 * O ganho real é o terceiro item: quando alguém em Sinop disser "não
 * consegui me cadastrar", existe uma linha dizendo qual passo falhou e
 * quanto tempo levou.
 */

export interface Contexto {
  requestId: string;
  acao: string;
}

export type RespostaAcao<T> =
  | { ok: true; dados: T }
  | {
      ok: false;
      codigo: AppError["codigo"];
      mensagem: string;
      id: string;
      campos?: { campo: string; mensagem: string }[];
    };

/** Entrada aceita: FormData (formulário) ou objeto (chamada direta). */
export type EntradaAcao = FormData | Record<string, unknown> | undefined;

function normalizar(entrada: EntradaAcao): Record<string, unknown> {
  if (!entrada) return {};
  if (entrada instanceof FormData) return objetoDoFormData(entrada);
  return entrada;
}

export interface DefinicaoAcao<TEntrada, TSaida> {
  /** Nome estável para o log, ex.: "auth.login". */
  nome: string;
  entrada: z.ZodType<TEntrada>;
  executar: (dados: TEntrada, ctx: Contexto) => Promise<TSaida>;
  /**
   * Campos que nunca podem ir para o log, mesmo já sanitizados — senha é o
   * caso óbvio. O sanitizador global já cobre telefone e documento.
   */
  naoLogar?: string[];
}

/**
 * Cria uma server action pública (sem exigir sessão).
 *
 * Devolve sempre `RespostaAcao`: nunca lança, nunca deixa o Next mostrar a
 * tela de erro genérica no meio de um cadastro.
 */
export function criarAcao<TEntrada, TSaida>(
  definicao: DefinicaoAcao<TEntrada, TSaida>,
) {
  return async function acao(
    entrada?: EntradaAcao,
  ): Promise<RespostaAcao<TSaida>> {
    const requestId = novoRequestId();
    const medir = cronometro();
    const ctx: Contexto = { requestId, acao: definicao.nome };

    try {
      const validado = validar(definicao.entrada, normalizar(entrada));

      if (!validado.ok) {
        log.erro(validado.erro, {
          requestId,
          acao: definicao.nome,
          ms: medir(),
          campos: validado.erro.campos?.map((c) => c.campo),
        });
        return respostaDeErro(validado.erro);
      }

      const dados = await definicao.executar(validado.valor, ctx);

      log.info("ação concluída", {
        requestId,
        acao: definicao.nome,
        ms: medir(),
      });

      return { ok: true, dados };
    } catch (e) {
      // `redirect()` e `notFound()` do Next são implementados como exceção.
      // Engoli-los aqui transformaria navegação em mensagem de erro, e o
      // sintoma seria incompreensível: a action "falha" sem nada errado.
      if (ehControleDeFluxoDoNext(e)) throw e;

      const erro = comoAppError(e);
      log.erro(erro, { requestId, acao: definicao.nome, ms: medir() });
      return respostaDeErro(erro);
    }
  };
}

/**
 * Distingue exceção de verdade do controle de fluxo do Next.
 *
 * `redirect()` e `notFound()` sinalizam por exceção, marcada em `digest`.
 * Esta envelopadora existe para que exceção nenhuma chegue à interface como
 * tela de erro — mas estas duas não são erro, são navegação.
 */
function ehControleDeFluxoDoNext(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;

  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}

function respostaDeErro(erro: AppError): RespostaAcao<never> {
  // `paraCliente()` traz `erro: true`, que aqui é redundante: o discriminante
  // do retorno já é `ok: false`.
  const payload = erro.paraCliente();
  return {
    ok: false,
    codigo: payload.codigo,
    mensagem: payload.mensagem,
    id: payload.id,
    ...(payload.campos ? { campos: payload.campos } : {}),
  };
}
