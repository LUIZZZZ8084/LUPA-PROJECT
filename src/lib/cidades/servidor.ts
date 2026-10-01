import "server-only";

import { cidadeComUf, type UF } from "./index";
import { CIDADES_POR_UF } from "./todas";

/**
 * A lista completa, para o servidor validar o que chega.
 *
 * Cidade digitada livre viraria "Sinop", "sinop" e "Sinop-MT" na mesma
 * base, e o filtro de cidade deixaria de agrupar. A checagem é contra o
 * IBGE, e o valor é sempre "Nome - UF" (ver `src/lib/cidades/index.ts`).
 */
const VALIDAS = new Set(
  (Object.entries(CIDADES_POR_UF) as [UF, readonly string[]][]).flatMap(
    ([uf, nomes]) => nomes.map((nome) => cidadeComUf(nome, uf)),
  ),
);

export function ehCidadeValida(valor: string): boolean {
  return VALIDAS.has(valor);
}

/** As cidades de um estado, já no formato gravado — para o filtro da busca. */
export function cidadesDaUf(uf: UF): string[] {
  return CIDADES_POR_UF[uf].map((nome) => cidadeComUf(nome, uf));
}
