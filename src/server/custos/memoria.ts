import { randomUUID } from "node:crypto";
import { CUSTOS_INICIAIS } from "./iniciais";
import type { CustoMensal, DadosDoCusto, RepositorioCustos } from "./tipos";

/**
 * Custos em demonstração: nascem com os mesmos dois do banco, para o bloco
 * "O Lupa já se paga?" não abrir vazio.
 */
export class RepositorioCustosMemoria implements RepositorioCustos {
  private itens: CustoMensal[] = CUSTOS_INICIAIS.map((c) => ({
    id: randomUUID(),
    ...c,
  }));

  async listar(): Promise<CustoMensal[]> {
    return this.itens.map((c) => ({ ...c }));
  }

  async criar(dados: DadosDoCusto): Promise<CustoMensal> {
    const custo = { id: randomUUID(), ...dados };
    this.itens.push(custo);
    return { ...custo };
  }

  async atualizar(
    id: string,
    dados: DadosDoCusto,
  ): Promise<CustoMensal | null> {
    const custo = this.itens.find((c) => c.id === id);
    if (!custo) return null;
    Object.assign(custo, dados);
    return { ...custo };
  }

  async remover(id: string): Promise<boolean> {
    const antes = this.itens.length;
    this.itens = this.itens.filter((c) => c.id !== id);
    return this.itens.length < antes;
  }
}
