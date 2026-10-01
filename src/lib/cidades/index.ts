import { CARREGADORES, type UF, UFS } from "./indice";

export { type UF, UFS };

/**
 * A cidade é gravada com o estado: "Sinop - MT" (#301).
 *
 * 232 nomes de município se repetem entre estados — "Bom Jesus" existe em
 * cinco. Com o app aberto ao Brasil inteiro, o nome sozinho deixou de
 * identificar a cidade, e um filtro por "Bom Jesus" juntaria cidades a
 * milhares de quilômetros uma da outra.
 *
 * O formato é o mesmo que a tela já mostrava ("Sinop - MT"), então o valor
 * gravado é também o rótulo: não existe mais um passo de "formatar a
 * cidade" que alguém pode esquecer numa tela nova.
 */
const SEPARADOR = " - ";

export function cidadeComUf(nome: string, uf: UF): string {
  return `${nome}${SEPARADOR}${uf}`;
}

function ehUf(valor: string): valor is UF {
  return UFS.some((u) => u.sigla === valor);
}

/** O estado de uma cidade gravada, ou `null` se o valor não tem estado. */
export function ufDaCidade(valor: string | null | undefined): UF | null {
  if (!valor) return null;
  const i = valor.lastIndexOf(SEPARADOR);
  if (i <= 0) return null;
  const uf = valor.slice(i + SEPARADOR.length);
  return ehUf(uf) ? uf : null;
}

/** "Sinop - MT" → "Sinop". Valor sem estado volta como veio. */
export function nomeDaCidade(valor: string): string {
  const uf = ufDaCidade(valor);
  return uf ? valor.slice(0, -(SEPARADOR.length + uf.length)) : valor;
}

/*
 * As cidades de cada estado chegam sob demanda, uma vez por carregamento
 * da página. O formulário não precisa de 5.500 nomes para alguém achar a
 * própria cidade — precisa dos do estado que ela escolheu.
 *
 * O cache e os ouvintes moram no módulo, e não num estado de componente,
 * para `useSyncExternalStore` ler o valor sem efeito nem `setState` — a
 * mesma saída que o `AlternarTema` já usa para ler o DOM.
 */
const carregadas = new Map<UF, readonly string[]>();
const pedidas = new Set<UF>();
const ouvintes = new Set<() => void>();

export function pedirCidades(uf: UF): void {
  if (carregadas.has(uf) || pedidas.has(uf)) return;
  pedidas.add(uf);
  CARREGADORES[uf]()
    .then((nomes) => {
      carregadas.set(uf, nomes);
      for (const avisar of ouvintes) avisar();
    })
    .catch(() => {
      // Sem rede, tenta de novo na próxima vez que alguém pedir.
      pedidas.delete(uf);
    });
}

export function cidadesJaCarregadas(uf: UF): readonly string[] | undefined {
  return carregadas.get(uf);
}

export function ouvirCidades(avisar: () => void): () => void {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}
