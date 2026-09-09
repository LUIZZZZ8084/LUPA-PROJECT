import { erros } from "../errors";
import type {
  DadosNovaCobranca,
  Pagamento,
  RepositorioPagamentos,
  StatusPagamento,
} from "./tipos";

/** Repositório de pagamentos em memória, para o modo demonstração. */
export class RepositorioPagamentosMemoria implements RepositorioPagamentos {
  private itens = new Map<string, Pagamento>();

  async porId(id: string): Promise<Pagamento | null> {
    return this.itens.get(id) ?? null;
  }

  async ultimoAprovado(usuarioId: string): Promise<Pagamento | null> {
    const dele = [...this.itens.values()]
      .filter((p) => p.usuarioId === usuarioId && p.status === "aprovado")
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return dele[0] ?? null;
  }

  async criar(dados: DadosNovaCobranca): Promise<Pagamento> {
    const agora = new Date().toISOString();
    const pagamento: Pagamento = {
      id: crypto.randomUUID(),
      usuarioId: dados.usuarioId,
      tipo: dados.tipo,
      valorCentavos: dados.valorCentavos,
      status: "pendente",
      mpPreferenceId: null,
      mpPaymentId: null,
      metadata: dados.metadata ?? {},
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.itens.set(pagamento.id, pagamento);
    return pagamento;
  }

  async definirPreferencia(
    id: string,
    mpPreferenceId: string,
  ): Promise<Pagamento> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Pagamento");

    const novo: Pagamento = {
      ...atual,
      mpPreferenceId,
      atualizadoEm: new Date().toISOString(),
    };
    this.itens.set(id, novo);
    return novo;
  }

  async aprovar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return this.mudarStatusSePendente(id, "aprovado", mpPaymentId);
  }

  async rejeitar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return this.mudarStatusSePendente(id, "rejeitado", mpPaymentId);
  }

  async cancelar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return this.mudarStatusSe(id, "pendente", "cancelado", mpPaymentId);
  }

  /** Parte de `aprovado`: estorno acontece depois de o dinheiro entrar. */
  async estornar(
    id: string,
    mpPaymentId: string | null,
  ): Promise<Pagamento | null> {
    return this.mudarStatusSe(id, "aprovado", "estornado", mpPaymentId);
  }

  private mudarStatusSePendente(
    id: string,
    status: "aprovado" | "rejeitado",
    mpPaymentId: string | null,
  ): Pagamento | null {
    return this.mudarStatusSe(id, "pendente", status, mpPaymentId);
  }

  private mudarStatusSe(
    id: string,
    de: StatusPagamento,
    para: StatusPagamento,
    mpPaymentId: string | null,
  ): Pagamento | null {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Pagamento");
    if (atual.status !== de) return null;
    const status = para;

    const novo: Pagamento = {
      ...atual,
      status,
      mpPaymentId: mpPaymentId ?? atual.mpPaymentId,
      atualizadoEm: new Date().toISOString(),
    };
    this.itens.set(id, novo);
    return novo;
  }

  limpar(): void {
    this.itens.clear();
  }
}
