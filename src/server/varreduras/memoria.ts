import type {
  ExecucaoDeVarredura,
  NomeDaVarredura,
  RepositorioVarreduras,
  ResumoDaVarredura,
} from "./tipos";

/** As varreduras em memória, para o modo demonstração e os testes. */
export class RepositorioVarredurasMemoria implements RepositorioVarreduras {
  private readonly linhas = new Map<NomeDaVarredura, ExecucaoDeVarredura>();

  async registrar(
    nome: NomeDaVarredura,
    execucao: { ok: boolean; resumo: ResumoDaVarredura; em: string },
  ): Promise<void> {
    const anterior = this.linhas.get(nome);
    this.linhas.set(nome, {
      nome,
      rodouEm: execucao.em,
      ok: execucao.ok,
      resumo: execucao.resumo,
      ultimaOkEm: execucao.ok ? execucao.em : (anterior?.ultimaOkEm ?? null),
    });
  }

  async todas(): Promise<ExecucaoDeVarredura[]> {
    return [...this.linhas.values()];
  }
}
