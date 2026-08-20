import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { repositorioMetricas } from "./index";
import type { Faturamento, PainelAdmin } from "./tipos";

/**
 * Preço de tabela da assinatura mensal de empresa.
 *
 * Fica aqui, e não no banco, porque ainda não há cobrança: é premissa de
 * projeção, não valor cobrado. Quando o Mercado Pago entrar, o número passa
 * a vir da fatura e esta constante some.
 */
export const PRECO_MENSAL_EMPRESA = 149;

/** Quantos dias o painel mostra por padrão. */
export const JANELA_PADRAO_DIAS = 30;

export async function painelAdmin(
  sessao: Autenticado | null,
  dias = JANELA_PADRAO_DIAS,
): Promise<PainelAdmin> {
  exigirCapacidade(sessao, "admin:metricas");

  const repo = repositorioMetricas();

  // Em paralelo: são quatro consultas independentes, e o painel recarrega
  // a cada poucos segundos.
  const [totais, cadastros, locais, planos] = await Promise.all([
    repo.totais(),
    repo.cadastrosPorDia(dias),
    repo.distribuicaoPorLocal(12),
    repo.planosDeEmpresa(),
  ]);

  const faturamento: Faturamento = {
    assinaturasAtivas: planos.mensal,
    emTeste: planos.trial,
    precoMensal: PRECO_MENSAL_EMPRESA,
    receitaMensalEstimada: planos.mensal * PRECO_MENSAL_EMPRESA,
    // Vira verdadeiro quando o valor passar a vir de pagamento confirmado.
    confirmado: false,
  };

  return {
    totais,
    cadastros,
    locais,
    faturamento,
    apuradoEm: new Date().toISOString(),
  };
}

/** Soma os cadastros da série, para o cartão de resumo. */
export function somarCadastros(painel: PainelAdmin): number {
  return painel.cadastros.reduce((soma, d) => soma + d.total, 0);
}
