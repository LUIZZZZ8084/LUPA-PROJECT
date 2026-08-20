import "server-only";

import { hash, verify } from "@node-rs/argon2";
import { log } from "../logger";

/**
 * Hash de senha com Argon2id.
 *
 * Argon2id em vez de bcrypt porque resiste a ataque com GPU e com hardware
 * dedicado, que é como quebra de senha é feita hoje. Foi o vencedor da
 * Password Hashing Competition e é a recomendação atual da OWASP.
 *
 * Os parâmetros seguem o perfil da OWASP para Argon2id: 19 MiB de memória,
 * 2 iterações, paralelismo 1. Escolhidos para caber com folga no limite de
 * memória de uma função serverless na Vercel — parâmetro que derruba a
 * função em produção não protege ninguém.
 */
const PARAMETROS = {
  /** 19 MiB, em KiB. */
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  /** 2 = Argon2id, o híbrido resistente a canal lateral e a GPU. */
  algorithm: 2,
} as const;

/**
 * Hash usado quando o e-mail não existe.
 *
 * Sem isso, um login com e-mail inexistente responde na hora e um login com
 * e-mail real leva ~50ms verificando a senha. A diferença é medível e
 * permite descobrir quem tem conta na plataforma — o que, aqui, revela quem
 * está procurando emprego. Comparar contra este hash iguala os tempos.
 */
const HASH_FALSO =
  "$argon2id$v=19$m=19456,t=2,p=1$c2FsZ2FkbzEyMzQ1Njc4$" +
  "9f7Q0GxQF0zVYVXk1jK5cWJ0kZ8YQZ3mYqL2N1pR4vA";

export async function gerarHash(senha: string): Promise<string> {
  return hash(senha, PARAMETROS);
}

/**
 * Confere a senha contra o hash.
 *
 * Nunca lança: hash corrompido ou em formato antigo devolve `false` e vira
 * uma linha de log. Uma exceção aqui derrubaria o login inteiro por causa de
 * um único registro ruim no banco.
 */
export async function conferirSenha(
  senha: string,
  hashArmazenado: string,
): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch (e) {
    log.warn("hash de senha ilegível", {
      acao: "auth.conferirSenha",
      motivo: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Gasta o mesmo tempo de uma verificação real, sem ter contra o que
 * verificar. Use no login quando o e-mail não existir.
 */
export async function gastarTempoDeVerificacao(senha: string): Promise<void> {
  await conferirSenha(senha, HASH_FALSO);
}

/**
 * Diz se o hash foi gerado com parâmetros mais fracos que os atuais.
 *
 * Quando subirmos o custo — porque hardware barateia —, os hashes antigos
 * continuam válidos e são regravados no próximo login bem-sucedido, sem
 * pedir que ninguém troque de senha.
 */
export function precisaRehash(hashArmazenado: string): boolean {
  const m = hashArmazenado.match(/\$m=(\d+),t=(\d+),p=(\d+)\$/);
  if (!m) return true;

  const [, memoria, tempo, paralelismo] = m.map(Number);
  return (
    memoria < PARAMETROS.memoryCost ||
    tempo < PARAMETROS.timeCost ||
    paralelismo < PARAMETROS.parallelism
  );
}
