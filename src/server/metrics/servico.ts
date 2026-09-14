import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { repositorioMetricas } from "./index";
import type { PainelAdmin } from "./tipos";

/** Quantos dias o painel mostra por padrão. */
export const JANELA_PADRAO_DIAS = 30;

/**
 * Quantas linhas de pressão cabem no bloco (#207).
 *
 * São ~30 rótulos possíveis no total — 27 ações com orçamento mais as três
 * de autenticação —, e a lista vem ordenada por bloqueio e volume. Vinte
 * mostra tudo que importa num dia agitado e evita que o painel vire
 * relatório quando alguém varrer o app inteiro.
 */
const TETOS_MOSTRADOS = 20;

export async function painelAdmin(
  sessao: Autenticado | null,
  dias = JANELA_PADRAO_DIAS,
): Promise<PainelAdmin> {
  exigirCapacidade(sessao, "admin:metricas");

  const repo = repositorioMetricas();

  /*
   * Em paralelo: são consultas independentes, e o painel recarrega a cada
   * poucos segundos.
   *
   * A pressão entra aqui, e não fora do polling como `buscasSemResultado`,
   * porque a pergunta dela é "está subindo **agora**". Vocabulário de busca
   * se lê uma vez por mês; recusa de teto se lê enquanto acontece, e a
   * fonte dela se apaga sozinha algumas janelas depois.
   */
  const [totais, cadastros, locais, caixa, pressao] = await Promise.all([
    repo.totais(),
    repo.cadastrosPorDia(dias),
    repo.distribuicaoPorLocal(12),
    repo.caixa(),
    repo.pressaoNosTetos(TETOS_MOSTRADOS),
  ]);

  return {
    totais,
    cadastros,
    locais,
    caixa,
    pressao,
    apuradoEm: new Date().toISOString(),
  };
}

/** Soma os cadastros da série, para o cartão de resumo. */
export function somarCadastros(painel: PainelAdmin): number {
  return painel.cadastros.reduce((soma, d) => soma + d.total, 0);
}
