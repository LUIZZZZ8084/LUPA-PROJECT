import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { PRECO_CENTAVOS } from "../pagamentos/planos";
import { repositorioMetricas } from "./index";
import type { Faturamento, PainelAdmin } from "./tipos";

/**
 * Preço de tabela do plano mensal de vagas, para a projeção do painel.
 *
 * Era `149` escrito à mão, e o comentário aqui dizia que "ainda não há
 * cobrança". As duas coisas envelheceram: a cobrança existe desde a #170,
 * e o plano mensal custa R$ 199,90. Enquanto isso, o painel do admin
 * multiplicava por um preço que não é praticado em lugar nenhum —
 * exatamente o que a regra da fonte única existe para impedir.
 *
 * Agora deriva de `PRECO_CENTAVOS`, como toda tela que mostra preço.
 *
 * **O número que sai daqui continua zero, e não é culpa desta linha:** a
 * contagem vem de `perfis_empresa.plano`, coluna que nada escreve — a
 * [#179](https://github.com/LUIZZZZ8084/LUPA-PROJECT/issues/179) trata
 * disso, e depende de uma decisão sobre o que entra em "receita".
 */
export const PRECO_MENSAL_EMPRESA = PRECO_CENTAVOS.empresa_mensal / 100;

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
