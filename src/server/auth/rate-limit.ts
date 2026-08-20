import { erros } from "../errors";
import { log } from "../logger";

/**
 * Limite de tentativas.
 *
 * Sem isto, uma lista de senhas comuns testada contra um e-mail conhecido
 * roda até acertar. Com Argon2 cada tentativa custa ~50ms, o que já atrasa
 * bastante — mas atrasar não é impedir.
 *
 * O contador vive em memória, o que num ambiente serverless significa: vale
 * por instância. Um atacante distribuído contorna. É proteção contra o
 * ataque comum, não contra o determinado — e é honesto dizer isso aqui em
 * vez de deixar parecer mais forte do que é. Quando houver volume, isto vira
 * um contador no Postgres ou num Redis, com a mesma interface.
 */

interface Janela {
  tentativas: number;
  primeiraEm: number;
  bloqueadoAte: number | null;
}

const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

/** Teto de chaves, para que a memória não cresça sem limite. */
const MAX_CHAVES = 10_000;

const janelas = new Map<string, Janela>();

function limparAntigas(agora: number): void {
  if (janelas.size < MAX_CHAVES) return;

  for (const [chave, janela] of janelas) {
    const expirada =
      agora - janela.primeiraEm > JANELA_MS &&
      (!janela.bloqueadoAte || agora > janela.bloqueadoAte);
    if (expirada) janelas.delete(chave);
  }

  // Ainda cheio depois da limpeza: descarta as mais antigas.
  if (janelas.size >= MAX_CHAVES) {
    const ordenadas = [...janelas.entries()].sort(
      (a, b) => a[1].primeiraEm - b[1].primeiraEm,
    );
    for (const [chave] of ordenadas.slice(0, Math.floor(MAX_CHAVES / 4))) {
      janelas.delete(chave);
    }
  }
}

/**
 * Lança `muitas_tentativas` se a chave estiver bloqueada.
 *
 * Chame antes de verificar a senha: o objetivo é justamente não gastar o
 * Argon2 quando já se sabe que a tentativa não vai valer.
 */
export function conferirLimite(chave: string): void {
  const agora = Date.now();
  const janela = janelas.get(chave);
  if (!janela) return;

  if (janela.bloqueadoAte && agora < janela.bloqueadoAte) {
    const segundos = Math.ceil((janela.bloqueadoAte - agora) / 1000);
    throw erros.muitasTentativas(segundos);
  }

  // Bloqueio venceu ou a janela passou: recomeça.
  if (janela.bloqueadoAte && agora >= janela.bloqueadoAte) {
    janelas.delete(chave);
  }
}

/** Registra uma tentativa que falhou e bloqueia ao atingir o teto. */
export function registrarFalha(chave: string): void {
  const agora = Date.now();
  limparAntigas(agora);

  const janela = janelas.get(chave);

  if (!janela || agora - janela.primeiraEm > JANELA_MS) {
    janelas.set(chave, {
      tentativas: 1,
      primeiraEm: agora,
      bloqueadoAte: null,
    });
    return;
  }

  janela.tentativas += 1;

  if (janela.tentativas >= MAX_TENTATIVAS) {
    janela.bloqueadoAte = agora + BLOQUEIO_MS;
    log.warn("limite de tentativas atingido", {
      acao: "auth.rateLimit",
      tentativas: janela.tentativas,
    });
  }
}

/** Zera o contador. Chame no login bem-sucedido. */
export function registrarSucesso(chave: string): void {
  janelas.delete(chave);
}

/** Só para teste. */
export function limparLimites(): void {
  janelas.clear();
}

export const CONFIG_LIMITE = {
  JANELA_MS,
  MAX_TENTATIVAS,
  BLOQUEIO_MS,
};
