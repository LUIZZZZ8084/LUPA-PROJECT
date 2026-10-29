import "server-only";

import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import {
  type DireitoDePublicar,
  direitoDePublicar,
} from "../carteiras/servico";
import { curriculoEmPdf } from "../curriculo/servico";
import { aplicarCompraSemCobranca } from "../pagamentos/servico";
import type { TipoPagamento } from "../pagamentos/tipos";
import { repositorioUsuarios } from "../repositories";

/**
 * A área de testes de compra do admin (#516).
 *
 * Cada função aqui faz o que a compra de verdade faz depois do "aprovado"
 * do Mercado Pago — liberar o produto — e devolve o que quem comprou
 * receberia. A liberação em si é a de `aplicarCompraSemCobranca`, que roda o
 * mesmo efeito do webhook; o que mora aqui é só o que a conta do admin
 * precisa para recebê-lo, e o resultado para a tela mostrar.
 */

/** As compras de vaga que a área sabe testar — a avulsa e os três planos. */
export const COMPRAS_DE_VAGA_TESTAVEIS = [
  "empresa_vaga_avulsa",
  "empresa_plano_5",
  "empresa_plano_10",
  "empresa_mensal",
] as const satisfies readonly TipoPagamento[];

export type CompraDeVagaTestavel = (typeof COMPRAS_DE_VAGA_TESTAVEIS)[number];

/**
 * Compra o gerador de currículo sem pagar e devolve o PDF.
 *
 * **O admin não tem perfil de candidato**, e `liberarGeradorCurriculo`
 * recusa quem não tem — com razão: numa compra de verdade, liberar para
 * uma conta sem perfil é defeito. Por isso o perfil nasce aqui, vazio,
 * antes da liberação. Não aparece em busca nenhuma: nasce com "quero ser
 * encontrado" desligado, e a view `candidatos_disponiveis` só lê
 * `candidato_clt`.
 *
 * O PDF sai com o nome, o e-mail, o telefone e a cidade da conta do admin
 * — o que um candidato que acabou de se cadastrar também teria.
 */
export async function testarCompraDoCurriculo(
  sessao: Autenticado | null,
): Promise<Buffer> {
  const admin = exigirCapacidade(sessao, "admin:testar_compras");
  const repo = repositorioUsuarios();

  if (!(await repo.perfilCandidato(admin.usuarioId))) {
    await repo.criarPerfilCandidato({
      usuarioId: admin.usuarioId,
      areaDesejada: null,
      resumo: null,
      curriculoUrl: null,
      disponibilidade: null,
      formacao: null,
      habilidades: [],
      experiencias: [],
      visivelParaEmpresas: false,
      geradorCurriculoLiberado: false,
    });
  }

  await aplicarCompraSemCobranca(admin, "curriculo_pdf");
  return curriculoEmPdf(admin.usuarioId);
}

/**
 * Compra vaga ou plano sem pagar e devolve a carteira como ficou.
 *
 * A carteira é a da empresa do próprio admin (#499) — a mesma que a área
 * de contratação dele lê. Dá para conferir lá, publicando uma vaga com o
 * que acabou de entrar.
 */
export async function testarCompraDeVaga(
  sessao: Autenticado | null,
  tipo: CompraDeVagaTestavel,
): Promise<DireitoDePublicar> {
  const admin = exigirCapacidade(sessao, "admin:testar_compras");
  await aplicarCompraSemCobranca(admin, tipo);
  return direitoDePublicar(admin.usuarioId);
}
