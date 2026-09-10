import type { Carteira, RepositorioCarteiras } from "./tipos";

/** Carteira em memória, para o modo demonstração. */
export class RepositorioCarteirasMemoria implements RepositorioCarteiras {
  private itens = new Map<string, Carteira>();

  async porUsuario(usuarioId: string): Promise<Carteira | null> {
    return this.itens.get(usuarioId) ?? null;
  }

  async creditar(usuarioId: string, quantidade: number): Promise<Carteira> {
    const atual = this.garantir(usuarioId);
    return this.gravar({
      ...atual,
      creditosVaga: atual.creditosVaga + quantidade,
    });
  }

  async consumirCredito(usuarioId: string): Promise<Carteira | null> {
    const atual = this.itens.get(usuarioId);
    if (!atual || atual.creditosVaga <= 0) return null;

    return this.gravar({ ...atual, creditosVaga: atual.creditosVaga - 1 });
  }

  async debitar(usuarioId: string, quantidade: number): Promise<Carteira> {
    const atual = this.garantir(usuarioId);
    return this.gravar({
      // Para em zero: quem já gastou o que comprou e depois contestou não
      // fica devendo crédito.
      ...atual,
      creditosVaga: Math.max(0, atual.creditosVaga - quantidade),
    });
  }

  async estenderMensalidade(
    usuarioId: string,
    dias: number,
  ): Promise<Carteira> {
    const atual = this.garantir(usuarioId);
    const baseMs = atual.mensalidadeValidaAte
      ? Math.max(Date.now(), new Date(atual.mensalidadeValidaAte).getTime())
      : Date.now();

    return this.gravar({
      ...atual,
      mensalidadeValidaAte: new Date(
        baseMs + dias * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  async revogarMensalidade(usuarioId: string): Promise<Carteira> {
    const atual = this.garantir(usuarioId);
    return this.gravar({ ...atual, mensalidadeValidaAte: null });
  }

  /** A carteira nasce zerada na primeira vez que alguém mexe nela. */
  private garantir(usuarioId: string): Carteira {
    const atual = this.itens.get(usuarioId);
    if (atual) return atual;

    const agora = new Date().toISOString();
    const nova: Carteira = {
      usuarioId,
      creditosVaga: 0,
      mensalidadeValidaAte: null,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.itens.set(usuarioId, nova);
    return nova;
  }

  private gravar(carteira: Carteira): Carteira {
    const nova = { ...carteira, atualizadoEm: new Date().toISOString() };
    this.itens.set(carteira.usuarioId, nova);
    return nova;
  }

  limpar(): void {
    this.itens.clear();
  }
}
