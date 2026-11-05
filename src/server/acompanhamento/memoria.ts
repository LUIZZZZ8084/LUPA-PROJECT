import type {
  Acompanhamento,
  DadosAcompanhamento,
  RepositorioAcompanhamento,
} from "./tipos";

/**
 * Acompanhamentos em memória, para o modo demonstração.
 *
 * Variável de módulo e não `globalThis`: só a action e as páginas leem
 * isto, e as duas dividem o mesmo bundle — a armadilha do repositório em
 * memória que não atravessa bundles é a de rota mais action (#164).
 */
export class RepositorioAcompanhamentoMemoria
  implements RepositorioAcompanhamento
{
  private itens = new Map<string, Acompanhamento>();

  async porCandidatura(candidaturaId: string): Promise<Acompanhamento | null> {
    return this.itens.get(candidaturaId) ?? null;
  }

  async porCandidaturas(
    candidaturaIds: readonly string[],
  ): Promise<Acompanhamento[]> {
    return candidaturaIds.flatMap((id) => {
      const item = this.itens.get(id);
      return item ? [item] : [];
    });
  }

  async salvar(dados: DadosAcompanhamento): Promise<Acompanhamento> {
    const salvo = { ...dados, atualizadoEm: new Date().toISOString() };
    this.itens.set(dados.candidaturaId, salvo);
    return salvo;
  }
}
