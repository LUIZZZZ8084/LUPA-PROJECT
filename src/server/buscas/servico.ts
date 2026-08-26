import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { repositorioBuscas } from "./index";
import type { TermoSemResultado } from "./tipos";

/**
 * Janela e tamanho da lista.
 *
 * Trinta dias porque a pergunta é de tendência, não de hoje: um termo que
 * aparece três vezes num mês é sinal, e o mesmo termo hoje é acaso. Vinte
 * linhas porque a lista existe para alguém ler inteira e decidir — cem
 * linhas viram um relatório que ninguém abre.
 */
const DIAS = 30;
const LIMITE = 20;

/**
 * O que as pessoas procuraram e não encontraram.
 *
 * Só admin. Não porque o dado seja sensível — ele não tem dono, é só termo
 * e contagem — mas porque é uma ferramenta de decisão de produto, e o
 * painel onde ela vive já é área administrativa.
 */
export async function buscasSemResultado(
  sessao: Autenticado | null,
): Promise<TermoSemResultado[]> {
  exigirCapacidade(sessao, "admin:metricas");
  return repositorioBuscas().maisBuscados(DIAS, LIMITE);
}

export { DIAS as DIAS_DA_JANELA };
