import type { RepositorioTalentos } from "./tipos";

/**
 * Talentos em memória, para a demonstração. Variável de módulo basta: só a
 * action e as páginas leem, no mesmo bundle (a armadilha da #164 é de rota).
 */
export class RepositorioTalentosMemoria implements RepositorioTalentos {
  private salvos = new Map<string, Set<string>>();

  async salvar(empresaId: string, candidatoId: string): Promise<void> {
    const da = this.salvos.get(empresaId) ?? new Set<string>();
    da.add(candidatoId);
    this.salvos.set(empresaId, da);
  }

  async remover(empresaId: string, candidatoId: string): Promise<void> {
    this.salvos.get(empresaId)?.delete(candidatoId);
  }

  async salvosDa(empresaId: string): Promise<Set<string>> {
    return new Set(this.salvos.get(empresaId) ?? []);
  }

  /** Só para teste. */
  limpar(): void {
    this.salvos.clear();
  }
}
