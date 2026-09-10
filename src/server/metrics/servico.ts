import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { repositorioMetricas } from "./index";
import type { PainelAdmin } from "./tipos";

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
  const [totais, cadastros, locais, caixa] = await Promise.all([
    repo.totais(),
    repo.cadastrosPorDia(dias),
    repo.distribuicaoPorLocal(12),
    repo.caixa(),
  ]);

  return {
    totais,
    cadastros,
    locais,
    caixa,
    apuradoEm: new Date().toISOString(),
  };
}

/** Soma os cadastros da série, para o cartão de resumo. */
export function somarCadastros(painel: PainelAdmin): number {
  return painel.cadastros.reduce((soma, d) => soma + d.total, 0);
}
