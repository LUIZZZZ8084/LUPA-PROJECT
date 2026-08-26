import type { OndeBuscou, RepositorioBuscas, TermoSemResultado } from "./tipos";

/**
 * Contagem em memória, para o modo demonstração.
 *
 * Não semeia nada. Ao contrário das vagas, aqui uma lista fabricada seria
 * pior que uma lista vazia: quem abrir o painel para decidir sobre busca
 * semântica precisa ver o que as pessoas procuraram de verdade, e um
 * "eletrecista" inventado por mim viraria decisão de produto.
 */
export class RepositorioBuscasMemoria implements RepositorioBuscas {
  /** `termo|onde` → total. */
  private readonly contagens = new Map<string, number>();

  async registrar(termo: string, onde: OndeBuscou): Promise<void> {
    const chave = `${termo}|${onde}`;
    this.contagens.set(chave, (this.contagens.get(chave) ?? 0) + 1);
  }

  async maisBuscados(
    _dias: number,
    limite: number,
  ): Promise<TermoSemResultado[]> {
    const somados = new Map<string, number>();

    for (const [chave, total] of this.contagens) {
      const termo = chave.split("|")[0];
      somados.set(termo, (somados.get(termo) ?? 0) + total);
    }

    return [...somados.entries()]
      .map(([termo, total]) => ({ termo, total }))
      .sort(
        (a, b) => b.total - a.total || a.termo.localeCompare(b.termo, "pt-BR"),
      )
      .slice(0, limite);
  }
}
