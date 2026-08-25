import { erros } from "../errors";
import type {
  DadosNovaVaga,
  EdicaoVaga,
  RepositorioVagas,
  Vaga,
} from "./tipos";

/**
 * Repositório de vagas em memória, para o modo demonstração.
 *
 * `semear` existe porque, ao contrário de publicações, a busca de vagas
 * precisa mostrar conteúdo desde o primeiro acesso — ninguém publicou nada
 * ainda. `src/lib/data.ts` chama uma vez com os dados de exemplo de Sinop;
 * chamadas seguintes não fazem nada, para não apagar o que a empresa já
 * publicou ou editou na demonstração.
 */
export class RepositorioVagasMemoria implements RepositorioVagas {
  private itens = new Map<string, Vaga>();

  semear(vagas: Vaga[]): void {
    if (this.itens.size > 0) return;
    for (const vaga of vagas) this.itens.set(vaga.id, vaga);
  }

  async porId(id: string): Promise<Vaga | null> {
    return this.itens.get(id) ?? null;
  }

  async porEmpresa(empresaId: string): Promise<Vaga[]> {
    return [...this.itens.values()]
      .filter((v) => v.empresaId === empresaId)
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm));
  }

  async listar(): Promise<Vaga[]> {
    return [...this.itens.values()].sort(
      (a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm),
    );
  }

  async criar(dados: DadosNovaVaga): Promise<Vaga> {
    const vaga: Vaga = {
      id: crypto.randomUUID(),
      empresaId: dados.empresaId,
      titulo: dados.titulo,
      descricao: dados.descricao,
      categoria: dados.categoria,
      cidade: dados.cidade,
      bairro: dados.bairro ?? null,
      tipoContrato: dados.tipoContrato,
      salarioMin: dados.salarioMin ?? null,
      salarioMax: dados.salarioMax ?? null,
      status: "aberta",
      criadoEm: new Date().toISOString(),
    };

    this.itens.set(vaga.id, vaga);
    return vaga;
  }

  async atualizar(id: string, campos: EdicaoVaga): Promise<Vaga> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Vaga");

    const nova: Vaga = { ...atual, ...campos };
    this.itens.set(id, nova);
    return nova;
  }

  async encerrar(id: string): Promise<Vaga> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Vaga");

    const nova: Vaga = { ...atual, status: "fechada" };
    this.itens.set(id, nova);
    return nova;
  }

  limpar(): void {
    this.itens.clear();
  }
}
