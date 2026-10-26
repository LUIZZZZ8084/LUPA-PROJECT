import { daquiA } from "@/lib/format";
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
  /** Quem publicou cada vaga, para o limite do plano em demonstração. */
  private autores = new Map<string, string>();

  semear(vagas: Vaga[]): void {
    if (this.itens.size > 0) return;
    for (const vaga of vagas) this.itens.set(vaga.id, vaga);
  }

  /** Todas as vagas, para o funil do painel em demonstração (#471). */
  todas(): Vaga[] {
    return [...this.itens.values()];
  }

  async porId(id: string): Promise<Vaga | null> {
    return this.itens.get(id) ?? null;
  }

  async porEmpresa(empresaId: string): Promise<Vaga[]> {
    return [...this.itens.values()]
      .filter((v) => v.empresaId === empresaId)
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm));
  }

  /**
   * Quando a conta é a própria empresa (produção, e os testes que ligam o
   * banco), conta tudo o que é da empresa. Quando não é — a demonstração,
   * onde toda conta publica sob a empresa fictícia —, conta só o que aquela
   * conta publicou: as vagas de exemplo e as das outras contas não ocupam o
   * lugar de ninguém.
   */
  async contarNoAr(empresaId: string, publicadaPor?: string): Promise<number> {
    const agora = Date.now();
    const separaPorConta =
      publicadaPor !== undefined && publicadaPor !== empresaId;

    return [...this.itens.values()].filter(
      (v) =>
        v.empresaId === empresaId &&
        v.status === "aberta" &&
        new Date(v.expiraEm).getTime() > agora &&
        (!separaPorConta || this.autores.get(v.id) === publicadaPor),
    ).length;
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
      endereco: dados.endereco,
      tipoContrato: dados.tipoContrato,
      modalidade: dados.modalidade,
      paraPcd: dados.paraPcd,
      salarioMin: dados.salarioMin ?? null,
      salarioMax: dados.salarioMax ?? null,
      habilidades: dados.habilidades ?? [],
      status: "aberta",
      criadoEm: new Date().toISOString(),
      expiraEm: daquiA(30),
    };

    this.itens.set(vaga.id, vaga);
    if (dados.publicadaPor) this.autores.set(vaga.id, dados.publicadaPor);
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

  async reativar(id: string): Promise<Vaga> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Vaga");

    const nova: Vaga = { ...atual, expiraEm: daquiA(30) };
    this.itens.set(id, nova);
    return nova;
  }

  limpar(): void {
    this.itens.clear();
  }
}
