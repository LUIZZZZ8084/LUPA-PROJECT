import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RepositorioPagamentosMemoria } from "./memoria";
import { RepositorioPagamentosPostgres } from "./postgres";
import type { Pagamento, RepositorioPagamentos } from "./tipos";

/**
 * O repositório em memória mora em `globalThis`, e não numa variável de
 * módulo.
 *
 * Server action e route handler viram **bundles diferentes** no build de
 * produção: cada um recebe a própria cópia deste módulo, e portanto o
 * próprio `Map`. A cobrança criada e aprovada pela action ficava invisível
 * para `/api/pagamentos/[id]`, que a tela de retorno consulta em laço — o
 * efeito era aplicado, a mensalidade estendia, e a tela girava em
 * "Confirmando o pagamento" até desistir.
 *
 * É a mesma família do contador de limite que vivia num `Map` de função
 * serverless e "valia por instância", registrada no `AGENTS.md`. Lá a
 * saída foi o banco; aqui não pode ser, porque o ponto da demonstração é
 * justamente não ter banco. `globalThis` é o que os dois bundles
 * compartilham dentro do mesmo processo.
 *
 * Em produção nada disto vale: com Supabase, os dois lados leem a mesma
 * tabela. Este é um defeito exclusivo do modo demonstração — que é
 * requisito de negócio deste projeto, não atalho, e por isso tem de
 * funcionar de ponta a ponta.
 */
const CHAVE = Symbol.for("lupa.pagamentos.memoria");

type Global = typeof globalThis & {
  [CHAVE]?: RepositorioPagamentosMemoria;
};

function memoriaCompartilhada(): RepositorioPagamentosMemoria {
  const g = globalThis as Global;
  g[CHAVE] ??= new RepositorioPagamentosMemoria();
  return g[CHAVE];
}

let cache: RepositorioPagamentos | null = null;

export function repositorioPagamentos(): RepositorioPagamentos {
  if (!cache) {
    cache = isSupabaseConfigured
      ? new RepositorioPagamentosPostgres()
      : memoriaCompartilhada();
  }
  return cache;
}

/**
 * As cobranças que existem, em demonstração — para o painel somar o caixa.
 *
 * Devolve `[]` quando o repositório em uso não é o de memória: com Supabase
 * ligado quem soma é o banco, na view `metricas_caixa`, e é o repositório
 * de métricas Postgres que responde. O `[]` aqui é o caminho que não
 * acontece, não um valor plausível — se ele aparecer no painel de alguém
 * com banco, o defeito é a fábrica ter escolhido o repositório errado.
 */
export function pagamentosEmMemoria(): Pagamento[] {
  const repo = repositorioPagamentos();
  return repo instanceof RepositorioPagamentosMemoria ? repo.todos() : [];
}

/** Só para teste: injeta uma implementação e devolve o restaurador. */
export function usarRepositorioPagamentos(
  repo: RepositorioPagamentos,
): () => void {
  const anterior = cache;
  cache = repo;
  return () => {
    cache = anterior;
  };
}

export type { RepositorioPagamentos };
export { RepositorioPagamentosMemoria };
