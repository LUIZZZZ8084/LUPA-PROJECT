import { randomUUID } from "node:crypto";
import type { DadosDaParceria, Parceria, RepositorioParceiros } from "./tipos";

/** Parcerias em demonstração, e nos testes. */
export class RepositorioParceirosMemoria implements RepositorioParceiros {
  private itens: Parceria[] = [];

  async listar(): Promise<Parceria[]> {
    return [...this.itens]
      .sort(
        (a, b) =>
          Number(a.encerradoEm !== null) - Number(b.encerradoEm !== null) ||
          b.criadoEm.localeCompare(a.criadoEm),
      )
      .map((p) => ({ ...p }));
  }

  async abertaPorEmail(email: string): Promise<Parceria | null> {
    const achada = this.itens.find(
      (p) => p.email === email && p.encerradoEm === null,
    );
    return achada ? { ...achada } : null;
  }

  async abertaPorUsuario(usuarioId: string): Promise<Parceria | null> {
    const achada = this.itens.find(
      (p) => p.usuarioId === usuarioId && p.encerradoEm === null,
    );
    return achada ? { ...achada } : null;
  }

  async porId(id: string): Promise<Parceria | null> {
    const achada = this.itens.find((p) => p.id === id);
    return achada ? { ...achada } : null;
  }

  async criar(
    dados: DadosDaParceria,
    _criadoPor: string | null,
  ): Promise<Parceria> {
    // O banco garante uma aberta por e-mail com um índice único; aqui, o
    // mesmo erro, para o serviço tratar os dois do mesmo jeito.
    if (await this.abertaPorEmail(dados.email)) {
      throw new Error("parceria aberta duplicada");
    }
    const parceria: Parceria = {
      id: randomUUID(),
      ...dados,
      criadoEm: new Date().toISOString(),
      encerradoEm: null,
      usuarioId: null,
      concedidoAte: null,
    };
    this.itens.push(parceria);
    return { ...parceria };
  }

  async registrarConcessao(
    id: string,
    usuarioId: string,
    concedidoAte: string,
  ): Promise<void> {
    const p = this.itens.find((x) => x.id === id);
    if (p) Object.assign(p, { usuarioId, concedidoAte });
  }

  async encerrar(id: string): Promise<Parceria | null> {
    const p = this.itens.find((x) => x.id === id && x.encerradoEm === null);
    if (!p) return null;
    p.encerradoEm = new Date().toISOString();
    return { ...p };
  }
}
