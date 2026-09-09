import type { Carteira, RepositorioCarteiras } from "@/server/carteiras/tipos";

/**
 * Uma carteira que nunca fica sem crédito.
 *
 * Serve aos testes que **publicam vaga como preparação** — candidatura,
 * visualização, mapeamento de empresa em demonstração. Desde a #172
 * publicar custa crédito, e sem isto cada um desses arquivos falharia por
 * um motivo que não é o dele: o teste que quebra não seria o que erra.
 *
 * É deliberadamente um objeto à parte, e não um saldo alto no repositório
 * de memória: quem lê o arquivo vê na primeira linha que ali a carteira
 * não está sendo medida. Quem mede é `carteira-de-vagas.test.ts`, e o
 * portão da publicação é medido em `vagas.test.ts` — os dois com o
 * repositório de verdade.
 */
export function carteiraInfinita(): RepositorioCarteiras {
  const agora = new Date().toISOString();
  const carteira = (usuarioId: string): Carteira => ({
    usuarioId,
    creditosVaga: Number.MAX_SAFE_INTEGER,
    mensalidadeValidaAte: null,
    criadoEm: agora,
    atualizadoEm: agora,
  });

  return {
    porUsuario: async (id) => carteira(id),
    creditar: async (id) => carteira(id),
    consumirCredito: async (id) => carteira(id),
    debitar: async (id) => carteira(id),
    estenderMensalidade: async (id) => carteira(id),
    revogarMensalidade: async (id) => carteira(id),
  };
}
