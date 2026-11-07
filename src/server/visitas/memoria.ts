import type { PaginaContada, RepositorioVisitas, VisitasNoDia } from "./tipos";

/** As visitas em memória, para o modo demonstração e os testes. */
export class RepositorioVisitasMemoria implements RepositorioVisitas {
  /** `pagina` → `dia` → total. */
  private readonly contagens = new Map<PaginaContada, Map<string, number>>();

  async registrar(pagina: PaginaContada): Promise<void> {
    const dia = new Date().toISOString().slice(0, 10);
    const porDia = this.contagens.get(pagina) ?? new Map<string, number>();
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    this.contagens.set(pagina, porDia);
  }

  async porDia(pagina: PaginaContada, desde: string): Promise<VisitasNoDia[]> {
    return [...(this.contagens.get(pagina) ?? new Map()).entries()]
      .filter(([dia]) => dia >= desde)
      .map(([dia, total]) => ({ dia, total }));
  }
}
