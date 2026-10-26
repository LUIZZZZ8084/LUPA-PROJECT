import "server-only";

import { passouDoPrazo } from "@/lib/format";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";
import { idDaEmpresaDoUsuario } from "../vagas/dono";
import { repositorioVagas } from "../vagas/index";
import { repositorioCarteiras } from "./index";
import type { Carteira } from "./tipos";

/** Quantos dias o plano mensal de vaga vale por cobrança. */
export const DIAS_PLANO_MENSAL = 30;

export interface DireitoDePublicar {
  /** Dá para publicar agora? */
  pode: boolean;
  /** O plano está valendo, cheio ou não. */
  mensalAtivo: boolean;
  /**
   * Quantas vagas o plano deixa no ar ao mesmo tempo, ou `null` quando é o
   * ilimitado. Só tem sentido com `mensalAtivo`.
   */
  limiteNoAr: number | null;
  /** Quantas vagas da empresa estão no ar agora. */
  noAr: number;
  /** O plano vale, mas já não cabe mais uma. */
  planoCheio: boolean;
  creditos: number;
  mensalidadeValidaAte: string | null;
  /** A empresa ainda tem a primeira vaga grátis para usar. */
  primeiraGratis: boolean;
}

/**
 * De onde saiu o direito de publicar — para devolver a mesma coisa se a
 * gravação falhar depois.
 */
export type FormaDeCobranca = "plano" | "credito" | "primeira-gratis";

function ler(
  carteira: Carteira | null,
  noAr: number,
  primeiraGratis: boolean,
): DireitoDePublicar {
  const validaAte = carteira?.mensalidadeValidaAte ?? null;
  const mensalAtivo = Boolean(validaAte) && !passouDoPrazo(validaAte as string);
  const limiteNoAr = mensalAtivo ? (carteira?.planoVagasNoAr ?? null) : null;
  const planoCheio = mensalAtivo && limiteNoAr !== null && noAr >= limiteNoAr;
  const creditos = carteira?.creditosVaga ?? 0;

  return {
    pode: (mensalAtivo && !planoCheio) || creditos > 0 || primeiraGratis,
    mensalAtivo,
    limiteNoAr,
    noAr,
    planoCheio,
    creditos,
    mensalidadeValidaAte: validaAte,
    primeiraGratis,
  };
}

/**
 * A primeira vaga grátis é de quem tem CNPJ conferido na Receita (#489).
 *
 * **Só com CNPJ, e não com CPF.** A conta de empresa por CPF nasce
 * verificada na hora, sem nenhuma consulta — o CPF é conferido só pelo
 * dígito, e qualquer número válido serve. Uma vaga grátis atrás disso seria
 * uma porta de abuso: criar conta e publicar de graça, quantas vezes
 * quisesse. O CNPJ conferido na Receita prova que a empresa existe e está
 * ativa, e é único (`cnpjEmUso`): uma conta por CNPJ, uma vaga grátis por
 * conta. O prestador que contrata como pessoa física também fica de fora,
 * pela mesma razão.
 *
 * O que isto não impede: excluir a conta e abrir outra com o mesmo CNPJ
 * dá outra vaga grátis. Custa o histórico todo da empresa — e, no pior
 * caso, uma vaga de R$ 19,90.
 */
async function elegivelParaPrimeiraGratis(
  usuarioId: string,
  carteira: Carteira | null,
): Promise<boolean> {
  if (carteira?.primeiraVagaGratisUsadaEm) return false;

  const usuarios = repositorioUsuarios();
  const usuario = await usuarios.porId(usuarioId);
  if (!usuario || usuario.papel !== "empresa" || !usuario.docVerificado) {
    return false;
  }

  const perfil = await usuarios.perfilEmpresa(usuarioId);
  return Boolean(perfil?.cnpj);
}

async function noArDe(usuarioId: string): Promise<number> {
  return repositorioVagas().contarNoAr(
    idDaEmpresaDoUsuario(usuarioId),
    usuarioId,
  );
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
  const carteira = await repositorioCarteiras().porUsuario(usuarioId);
  const [noAr, primeiraGratis] = await Promise.all([
    noArDe(usuarioId),
    elegivelParaPrimeiraGratis(usuarioId, carteira),
  ]);
  return ler(carteira, noAr, primeiraGratis);
}

/**
 * Cobra a publicação, e diz de onde saiu: do plano (nada), da primeira vaga
 * grátis ou de um crédito — nesta ordem.
 *
 * Devolve `null` quando não havia como cobrar — quem chama recusa a
 * publicação. **A decisão e o débito acontecem na mesma instrução do
 * banco** (`where creditos_vaga > 0`, `where ... is null`): checar antes e
 * gastar depois deixaria duas publicações simultâneas com um crédito só
 * passarem as duas, e a segunda sairia de graça.
 *
 * **A primeira grátis vem antes do crédito**, e não depois: quem comprou
 * uma vaga e ainda tem a de boas-vindas não deve gastar o dinheiro dele
 * com ela de pé.
 */
export async function gastarParaPublicar(
  usuarioId: string,
): Promise<FormaDeCobranca | null> {
  const repo = repositorioCarteiras();
  const carteira = await repo.porUsuario(usuarioId);
  const atual = ler(carteira, await noArDe(usuarioId), false);

  /*
   * O plano é conferido antes, e não dentro de um `update`: quem tem plano
   * com lugar não gasta nada, e uma instrução que abrangesse os três casos
   * precisaria decidir o que fazer com o saldo de quem tem mais de um. O
   * limite é lido aqui e a vaga gravada depois — duas publicações
   * simultâneas com um lugar só passam as duas, e a empresa fica com uma
   * vaga a mais no ar. Aceito: o pior caso é um anúncio extra para quem
   * está pagando, e a trava que importa — a de dinheiro — não é esta.
   */
  if (atual.mensalAtivo && !atual.planoCheio) return "plano";

  if (await elegivelParaPrimeiraGratis(usuarioId, carteira)) {
    if (await repo.reivindicarPrimeiraVagaGratis(usuarioId)) {
      log.info("primeira vaga grátis usada", { acao: "carteira.primeira" });
      return "primeira-gratis";
    }
  }

  const depois = await repo.consumirCredito(usuarioId);
  if (!depois) return null;

  log.info("crédito de vaga consumido", {
    acao: "carteira.consumir",
    restantes: depois.creditosVaga,
  });
  return "credito";
}

/** Devolve o que foi gasto quando a publicação falha depois da cobrança. */
export async function devolverCobranca(
  usuarioId: string,
  forma: FormaDeCobranca,
): Promise<void> {
  const repo = repositorioCarteiras();

  if (forma === "credito") {
    await repo.creditar(usuarioId, 1);
    log.info("crédito de vaga devolvido", { acao: "carteira.devolver" });
  } else if (forma === "primeira-gratis") {
    await repo.liberarPrimeiraVagaGratis(usuarioId);
    log.info("primeira vaga grátis devolvida", { acao: "carteira.devolver" });
  }
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

/**
 * Estende o plano pago e grava o limite dele.
 *
 * `vagasNoAr` é o do plano que acabou de ser pago (`null`, o ilimitado):
 * quem troca de plano passa a ter o limite do novo na hora.
 */
export async function estenderPlanoMensal(
  usuarioId: string,
  vagasNoAr: number | null,
): Promise<void> {
  await repositorioCarteiras().estenderMensalidade(
    usuarioId,
    DIAS_PLANO_MENSAL,
    vagasNoAr,
  );
  log.info("plano mensal de vaga estendido", {
    acao: "carteira.mensal",
    vagasNoAr,
  });
}

export async function revogarPlanoMensal(usuarioId: string): Promise<void> {
  await repositorioCarteiras().revogarMensalidade(usuarioId);
  log.info("plano mensal de vaga revogado", {
    acao: "carteira.mensal_revogado",
  });
}
