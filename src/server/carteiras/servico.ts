import "server-only";

import { passouDoPrazo } from "@/lib/format";
import { log } from "../logger";
import { repositorioCarteiras } from "./index";
import type { Carteira } from "./tipos";

/** Quantos dias o plano mensal de vaga vale por cobrança. */
export const DIAS_PLANO_MENSAL = 30;

export interface DireitoDePublicar {
  /** Dá para publicar agora? */
  pode: boolean;
  /** Enquanto vale, publica quantas quiser sem gastar crédito. */
  mensalAtivo: boolean;
  creditos: number;
  mensalidadeValidaAte: string | null;
}

function ler(carteira: Carteira | null): DireitoDePublicar {
  const validaAte = carteira?.mensalidadeValidaAte ?? null;
  const mensalAtivo = Boolean(validaAte) && !passouDoPrazo(validaAte as string);
  const creditos = carteira?.creditosVaga ?? 0;

  return {
    pode: mensalAtivo || creditos > 0,
    mensalAtivo,
    creditos,
    mensalidadeValidaAte: validaAte,
  };
}

/**
 * O que a pessoa pode publicar hoje — para a **tela** decidir o que
 * oferecer.
 *
 * Quem publica de verdade passa por `gastarParaPublicar`, que decide de
 * novo. Isto aqui existe para o formulário não ser mostrado a quem vai
 * ser recusado no fim: "botão que só recusa depois do clique" é a
 * armadilha que este projeto já registra três vezes.
 */
export async function direitoDePublicar(
  usuarioId: string,
): Promise<DireitoDePublicar> {
  return ler(await repositorioCarteiras().porUsuario(usuarioId));
}

/**
 * Cobra a publicação: nada, se o mensal estiver ativo; um crédito, se
 * não.
 *
 * Devolve `false` quando não havia como cobrar — quem chama recusa a
 * publicação. **A decisão e o débito acontecem na mesma instrução do
 * banco** (`where creditos_vaga > 0`): checar antes e gastar depois
 * deixaria duas publicações simultâneas com um crédito só passarem as
 * duas, e a segunda sairia de graça.
 */
export async function gastarParaPublicar(usuarioId: string): Promise<boolean> {
  const repo = repositorioCarteiras();
  const atual = ler(await repo.porUsuario(usuarioId));

  /*
   * O mensal é conferido antes, e não dentro do `update`: quem tem plano
   * ativo não gasta crédito nenhum, e um `update` condicional que
   * abrangesse os dois casos precisaria decidir o que fazer com o saldo
   * de quem tem os dois. Aqui não há corrida a perder — o pior caso é o
   * plano vencer entre a leitura e a publicação, o que dá uma vaga a mais
   * a quem acabou de pagar um mês.
   */
  if (atual.mensalAtivo) return true;

  const depois = await repo.consumirCredito(usuarioId);
  if (!depois) return false;

  log.info("crédito de vaga consumido", {
    acao: "carteira.consumir",
    restantes: depois.creditosVaga,
  });
  return true;
}

/** Devolve o crédito quando a publicação falha depois da cobrança. */
export async function devolverCredito(usuarioId: string): Promise<void> {
  await repositorioCarteiras().creditar(usuarioId, 1);
  log.info("crédito de vaga devolvido", { acao: "carteira.devolver" });
}

export async function creditarVagas(
  usuarioId: string,
  quantidade: number,
): Promise<void> {
  await repositorioCarteiras().creditar(usuarioId, quantidade);
  log.info("créditos de vaga comprados", {
    acao: "carteira.creditar",
    quantidade,
  });
}

export async function debitarVagas(
  usuarioId: string,
  quantidade: number,
): Promise<void> {
  await repositorioCarteiras().debitar(usuarioId, quantidade);
  log.info("créditos de vaga retirados", {
    acao: "carteira.debitar",
    quantidade,
  });
}

export async function estenderPlanoMensal(usuarioId: string): Promise<void> {
  await repositorioCarteiras().estenderMensalidade(
    usuarioId,
    DIAS_PLANO_MENSAL,
  );
  log.info("plano mensal de vaga estendido", { acao: "carteira.mensal" });
}

export async function revogarPlanoMensal(usuarioId: string): Promise<void> {
  await repositorioCarteiras().revogarMensalidade(usuarioId);
  log.info("plano mensal de vaga revogado", {
    acao: "carteira.mensal_revogado",
  });
}
