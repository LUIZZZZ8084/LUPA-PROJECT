import { SearchX } from "lucide-react";
import { Panel } from "@/components/ui/card";
import type { TermoSemResultado } from "@/server/buscas/tipos";

/**
 * O que as pessoas procuraram e não encontraram.
 *
 * Não é métrica de acompanhar: é insumo de uma decisão. Cada linha aqui é
 * alguém que digitou uma palavra e recebeu tela vazia — e o padrão dessas
 * palavras responde se basta ampliar a tabela de sinônimos em
 * `src/lib/skills.ts` ou se a busca precisa virar semântica.
 *
 * **Cauda curta e repetitiva** — cinco termos respondendo pela maioria —
 * significa sinônimo: barato, previsível, sem chamada de rede. **Cauda
 * longa e variada** significa que uma lista não dá conta, e aí a busca
 * vetorial se paga.
 */
export function BuscasSemResultado({
  termos,
  dias,
}: {
  termos: TermoSemResultado[];
  dias: number;
}) {
  return (
    <Panel className="mt-6">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <SearchX size={17} className="text-warn" />
        Buscas sem resultado
      </h2>
      <p className="mt-1 text-xs text-muted">
        Últimos {dias} dias. Só o termo — não guardamos quem buscou.
      </p>

      {termos.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Ninguém buscou e ficou sem resposta ainda. É a lista que a gente quer
          vazia — e é a mesma que diz, quando enche, o que falta no catálogo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {termos.map((t) => (
            <li
              key={t.termo}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{t.termo}</span>
              <span className="flex-none tabular-nums text-muted">
                {t.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
