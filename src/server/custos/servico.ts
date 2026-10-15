import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { repositorioCustos } from "./index";
import type { CustoMensal, DadosDoCusto } from "./tipos";

/**
 * Quantos custos cabem na lista (#473). Contador, aluguel, domínio, os
 * planos: uma dúzia já cobre uma empresa pequena. O teto é contra a lista
 * sem fim, que o painel puxaria inteira a cada 15 segundos.
 */
export const LIMITE_DE_CUSTOS = 30;

/** Os custos, na ordem em que a receita os cobre. Só o admin lê. */
export async function listarCustos(
  sessao: Autenticado | null,
): Promise<CustoMensal[]> {
  exigirCapacidade(sessao, "admin:custos");
  return repositorioCustos().listar();
}

export async function adicionarCusto(
  sessao: Autenticado | null,
  dados: DadosDoCusto,
): Promise<CustoMensal> {
  exigirCapacidade(sessao, "admin:custos");
  const repo = repositorioCustos();
  if ((await repo.listar()).length >= LIMITE_DE_CUSTOS) {
    throw erros.limiteExcedido(
      `A lista tem no máximo ${LIMITE_DE_CUSTOS} custos. Junte ou remova algum antes.`,
    );
  }
  return repo.criar(dados);
}

export async function editarCusto(
  sessao: Autenticado | null,
  id: string,
  dados: DadosDoCusto,
): Promise<CustoMensal> {
  exigirCapacidade(sessao, "admin:custos");
  const custo = await repositorioCustos().atualizar(id, dados);
  if (!custo) throw erros.naoEncontrado("Custo");
  return custo;
}

export async function removerCusto(
  sessao: Autenticado | null,
  id: string,
): Promise<void> {
  exigirCapacidade(sessao, "admin:custos");
  if (!(await repositorioCustos().remover(id))) {
    throw erros.naoEncontrado("Custo");
  }
}
