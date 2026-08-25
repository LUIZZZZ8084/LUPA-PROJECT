import { empresaDoPainel } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { type Autenticado, exigirCapacidade, pode } from "../auth/rbac";
import { erros } from "../errors";
import { repositorioVisualizacoes } from "./index";
import type { PontoDaSerie } from "./tipos";

/**
 * Janela do painel. Trinta dias é o que cabe num gráfico de celular sem
 * virar borrão e ainda mostra um mês inteiro de sazonalidade — segunda-feira
 * move mais que sábado, e isso só aparece com algumas semanas.
 */
export const DIAS_DA_SERIE = 30;

/**
 * Mesma regra do serviço de vagas: em produção a empresa é a da sessão; em
 * demonstração o painel mostra sempre a mesma empresa fictícia, senão o
 * gráfico ficaria zerado justamente na tela que existe para ser mostrada.
 */
function idDaEmpresa(sessao: Autenticado): string {
  return isSupabaseConfigured
    ? sessao.usuarioId
    : empresaDoPainel(sessao.usuarioId);
}

/**
 * Se esta sessão tem painel de empresa para ver.
 *
 * Em produção, só empresa. Em demonstração, qualquer conta: o painel
 * inteiro já é o da empresa fictícia — vagas e currículos inclusive —, e
 * deixar só o gráfico de fora daria uma tela pela metade justamente para
 * quem está vendo o produto pela primeira vez.
 *
 * A pergunta mora aqui, ao lado da regra que ela espelha. Na tela, seria
 * uma segunda cópia da mesma decisão, livre para divergir com o tempo.
 */
export function temPainelDeEmpresa(sessao: Autenticado | null): boolean {
  if (!sessao) return false;
  if (!isSupabaseConfigured) return true;
  return pode(sessao.papel, "vaga:ver_candidaturas_proprias");
}

/**
 * Série diária das vagas da empresa da sessão.
 *
 * Não recebe id de empresa de fora de propósito. Um parâmetro aqui seria a
 * porta para trocar o id na URL e ler o movimento do concorrente — a mesma
 * razão pela qual a edição de vaga confere dono.
 */
export async function serieDoPainel(
  sessao: Autenticado | null,
): Promise<PontoDaSerie[]> {
  if (!sessao) throw erros.naoAutenticado("sem sessão");
  if (isSupabaseConfigured) {
    exigirCapacidade(sessao, "vaga:ver_candidaturas_proprias");
  }

  return repositorioVisualizacoes().serieDaEmpresa(
    idDaEmpresa(sessao),
    DIAS_DA_SERIE,
  );
}

/** Totais da janela, para os números grandes acima do gráfico. */
export function totaisDaSerie(serie: PontoDaSerie[]): {
  visualizacoes: number;
  candidaturas: number;
} {
  return serie.reduce(
    (acc, p) => ({
      visualizacoes: acc.visualizacoes + p.visualizacoes,
      candidaturas: acc.candidaturas + p.candidaturas,
    }),
    { visualizacoes: 0, candidaturas: 0 },
  );
}
