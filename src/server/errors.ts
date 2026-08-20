/**
 * Taxonomia de erro do servidor.
 *
 * Duas mensagens, sempre separadas:
 *
 * - `mensagem` vai para a tela, em português, dizendo o que fazer. Nunca
 *   contém nome de tabela, stack trace ou detalhe de infraestrutura — isso
 *   confunde quem está tentando arrumar emprego e ajuda quem está tentando
 *   invadir.
 * - `detalhe` fica no log, para quem vai depurar.
 *
 * Todo erro carrega um `id` curto que aparece nos dois lugares. Quando
 * alguém disser "deu erro K3F9QB", dá para achar a linha exata no log.
 */

export type CodigoErro =
  | "validacao"
  | "nao_autenticado"
  | "sem_permissao"
  | "nao_encontrado"
  | "conflito"
  | "limite_excedido"
  | "muitas_tentativas"
  | "indisponivel"
  | "interno";

/** Status HTTP de cada código, para quando o erro sai por uma rota. */
const STATUS: Record<CodigoErro, number> = {
  validacao: 422,
  nao_autenticado: 401,
  sem_permissao: 403,
  nao_encontrado: 404,
  conflito: 409,
  limite_excedido: 409,
  muitas_tentativas: 429,
  indisponivel: 503,
  interno: 500,
};

/**
 * Mensagens padrão. Sempre dizem o próximo passo, não só o que deu errado —
 * "Sessão expirada" deixa a pessoa parada; "Entre de novo para continuar"
 * não.
 */
const MENSAGEM_PADRAO: Record<CodigoErro, string> = {
  validacao: "Revise os campos destacados.",
  nao_autenticado: "Entre na sua conta para continuar.",
  sem_permissao: "Esta área não está disponível para a sua conta.",
  nao_encontrado: "Não encontramos o que você procurava.",
  conflito: "Esse registro já existe.",
  limite_excedido: "Você atingiu o limite deste plano.",
  muitas_tentativas: "Muitas tentativas. Espere um minuto e tente de novo.",
  indisponivel: "Serviço temporariamente indisponível. Tente em instantes.",
  interno: "Algo deu errado do nosso lado. Já estamos sabendo.",
};

/** Alfabeto sem caracteres ambíguos: ninguém confunde 0 com O ao ditar. */
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function gerarIdErro(): string {
  let id = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) id += ALFABETO[b % ALFABETO.length];
  return id;
}

export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export class AppError extends Error {
  readonly codigo: CodigoErro;
  readonly mensagem: string;
  readonly id: string;
  readonly status: number;
  readonly campos?: ErroCampo[];
  /** Contexto para o log. Passa pelo sanitizador antes de sair. */
  readonly contexto?: Record<string, unknown>;

  constructor(
    codigo: CodigoErro,
    opcoes: {
      mensagem?: string;
      detalhe?: string;
      campos?: ErroCampo[];
      contexto?: Record<string, unknown>;
      causa?: unknown;
    } = {},
  ) {
    super(opcoes.detalhe ?? opcoes.mensagem ?? MENSAGEM_PADRAO[codigo], {
      cause: opcoes.causa,
    });
    this.name = "AppError";
    this.codigo = codigo;
    this.mensagem = opcoes.mensagem ?? MENSAGEM_PADRAO[codigo];
    this.id = gerarIdErro();
    this.status = STATUS[codigo];
    this.campos = opcoes.campos;
    this.contexto = opcoes.contexto;
  }

  /** O que pode ser enviado para o navegador — sem detalhe técnico. */
  paraCliente() {
    return {
      erro: true as const,
      codigo: this.codigo,
      mensagem: this.mensagem,
      id: this.id,
      ...(this.campos ? { campos: this.campos } : {}),
    };
  }
}

export function ehAppError(valor: unknown): valor is AppError {
  return valor instanceof AppError;
}

/**
 * Converte qualquer coisa lançada em AppError.
 *
 * Erro desconhecido vira sempre `interno` com mensagem genérica: a mensagem
 * original de uma exceção de banco pode expor nome de coluna e estrutura.
 */
export function comoAppError(valor: unknown): AppError {
  if (ehAppError(valor)) return valor;

  if (valor instanceof Error) {
    return new AppError("interno", {
      detalhe: valor.message,
      causa: valor,
    });
  }

  return new AppError("interno", { detalhe: String(valor) });
}

/* ---------- Atalhos, para a chamada ficar legível ---------- */

export const erros = {
  validacao: (campos: ErroCampo[], mensagem?: string) =>
    new AppError("validacao", { campos, mensagem }),

  naoAutenticado: (detalhe?: string) =>
    new AppError("nao_autenticado", { detalhe }),

  semPermissao: (detalhe?: string) =>
    new AppError("sem_permissao", { detalhe }),

  naoEncontrado: (oQue: string) =>
    new AppError("nao_encontrado", {
      mensagem: `${oQue} não encontrado.`,
      detalhe: `${oQue} não encontrado`,
    }),

  conflito: (mensagem: string, detalhe?: string) =>
    new AppError("conflito", { mensagem, detalhe }),

  limiteExcedido: (mensagem: string, contexto?: Record<string, unknown>) =>
    new AppError("limite_excedido", { mensagem, contexto }),

  muitasTentativas: (segundos: number) =>
    new AppError("muitas_tentativas", {
      mensagem: `Muitas tentativas. Espere ${segundos}s e tente de novo.`,
      contexto: { segundos },
    }),

  indisponivel: (detalhe?: string) => new AppError("indisponivel", { detalhe }),

  interno: (detalhe?: string, causa?: unknown) =>
    new AppError("interno", { detalhe, causa }),
};
