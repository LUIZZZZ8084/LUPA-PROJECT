import { isSupabaseConfigured } from "@/lib/supabase/config";
import { erros } from "../errors";
import type { Orcamento } from "../limites";
import { log } from "../logger";
import type { JanelaDeLimite } from "../metrics/tipos";
import { RepositorioLimitePostgres } from "./rate-limit-postgres";
import { CONFIG_LIMITE, type RepositorioLimite } from "./rate-limit-tipos";

/**
 * Limite de tentativas.
 *
 * Sem isto, uma lista de senhas comuns testada contra um e-mail conhecido
 * roda até acertar. Com Argon2 cada tentativa custa ~50ms, o que já atrasa
 * bastante — mas atrasar não é impedir.
 *
 * Com Supabase ligado o contador vive no banco, e é isso que faz o limite
 * valer de verdade: em memória ele sumia a cada deploy e valia por
 * instância de função, então quem caísse noutra instância começava do
 * zero. Com concorrência suficiente, virava sugestão.
 *
 * A versão em memória continua existindo para o modo demonstração e para o
 * teste. Contra um atacante distribuído, nenhuma das duas é suficiente
 * sozinha — o passo seguinte é rate limit na borda, e vale quando aparecer
 * abuso medido.
 */

const JANELA_MS = CONFIG_LIMITE.JANELA_MS;
const MAX_TENTATIVAS = CONFIG_LIMITE.MAX_TENTATIVAS;
const BLOQUEIO_MS = CONFIG_LIMITE.BLOQUEIO_MS;

interface Janela {
  tentativas: number;
  primeiraEm: number;
  bloqueadoAte: number | null;
}

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
 * A versão em memória, que continua servindo a demonstração e os testes.
 *
 * A regra é a mesma da versão em banco; o que muda é o alcance — aqui o
 * contador vale por processo.
 */
class RepositorioLimiteMemoria implements RepositorioLimite {
  async bloqueadoAte(chave: string): Promise<Date | null> {
    const agora = Date.now();
    const janela = janelas.get(chave);
    if (!janela?.bloqueadoAte) return null;

    if (agora < janela.bloqueadoAte) return new Date(janela.bloqueadoAte);

    // Bloqueio venceu: recomeça.
    janelas.delete(chave);
    return null;
  }

  async registrarFalha(chave: string): Promise<void> {
    registrarFalhaEmMemoria(chave);
  }

  async registrarSucesso(chave: string): Promise<void> {
    janelas.delete(chave);
  }
  async registrarUso(
    chave: string,
    orcamento: Orcamento,
  ): Promise<Date | null> {
    const agora = Date.now();
    limparAntigas(agora);
    const janelaMs = orcamento.janelaSegundos * 1000;

    const janela = janelas.get(chave);
    if (!janela || agora - janela.primeiraEm > janelaMs) {
      janelas.set(chave, {
        tentativas: 1,
        primeiraEm: agora,
        bloqueadoAte: null,
      });
      return null;
    }

    janela.tentativas += 1;
    // `>` e não `>=`: `chamadas` é quantas passam, e a seguinte é a
    // recusada. Espelha o `+ 1` da versão em banco.
    if (janela.tentativas > orcamento.chamadas) {
      janela.bloqueadoAte = agora + janelaMs;
      return new Date(janela.bloqueadoAte);
    }
    return null;
  }
}

const memoria = new RepositorioLimiteMemoria();

let cache: RepositorioLimite | null = null;

function repositorio(): RepositorioLimite {
  if (!cache) {
    cache = isSupabaseConfigured ? new RepositorioLimitePostgres() : memoria;
  }
  return cache;
}

/**
 * Lança `muitas_tentativas` se a chave estiver bloqueada.
 *
 * Chame antes de verificar a senha: o objetivo é justamente não gastar o
 * Argon2 quando já se sabe que a tentativa não vai valer.
 */
export async function conferirLimite(chave: string): Promise<void> {
  const ate = await repositorio().bloqueadoAte(chave);
  if (!ate) return;

  const segundos = Math.ceil((ate.getTime() - Date.now()) / 1000);
  throw erros.muitasTentativas(segundos);
}

/** Registra uma tentativa que falhou e bloqueia ao atingir o teto. */
export async function registrarFalha(chave: string): Promise<void> {
  await repositorio().registrarFalha(chave);
}

function registrarFalhaEmMemoria(chave: string): void {
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
export async function registrarSucesso(chave: string): Promise<void> {
  await repositorio().registrarSucesso(chave);
}

/**
 * As janelas vivas, para o painel do modo demonstração (#207).
 *
 * **Em produção isto devolve sempre lista vazia**, e não por acaso: com
 * Supabase configurado quem conta é `RepositorioLimitePostgres`, e este
 * `Map` nunca recebe nada. Lá o painel lê a view `metricas_pressao`, onde
 * a chave — que é `login:<e-mail>` nas de autenticação — não sai do banco.
 *
 * Ou seja: a única implementação que enxerga chave crua é a que só existe
 * onde as contas são de mentira.
 */
export function janelasVivas(): JanelaDeLimite[] {
  return [...janelas.entries()].map(([chave, janela]) => ({
    chave,
    tentativas: janela.tentativas,
    bloqueadoAte: janela.bloqueadoAte ? new Date(janela.bloqueadoAte) : null,
  }));
}

/** Só para teste. */
export function limparLimites(): void {
  janelas.clear();
  cache = null;
}

export type { RepositorioLimite };
export { CONFIG_LIMITE };

/**
 * Gasta uma chamada do orçamento da ação e recusa quando não cabe mais.
 *
 * Diferente de `conferirLimite` + `registrarFalha`, que são dois passos
 * porque lá a pergunta é feita **antes** de gastar o Argon2. Aqui é um
 * passo só, e de propósito: a mesma instrução que soma é a que responde se
 * ainda cabia, então duas chamadas simultâneas não conseguem as duas ler
 * "cabe" e passar.
 *
 * Quem estourou continua somando enquanto insiste, e isso é intencional:
 * num teto de volume, insistir **é** o comportamento que se contém. Para
 * quem errou de boa-fé o custo é a janela, que é curta justamente por
 * isso.
 */
export async function consumirOrcamento(
  chave: string,
  orcamento: Orcamento,
): Promise<void> {
  const bloqueadoAte = await repositorio().registrarUso(chave, orcamento);
  if (!bloqueadoAte) return;

  const segundos = Math.max(
    1,
    Math.ceil((bloqueadoAte.getTime() - Date.now()) / 1000),
  );
  throw erros.muitasTentativas(segundos);
}
