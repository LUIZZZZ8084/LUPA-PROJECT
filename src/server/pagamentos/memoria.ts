import { erros } from "../errors";
import type {
  Assinatura,
  DadosCobrancaLiquidada,
  DadosNovaAssinatura,
  DadosNovaCobranca,
  Pagamento,
  RepositorioPagamentos,
  StatusAssinatura,
  StatusPagamento,
  TipoPagamento,
} from "./tipos";
import { STATUS_ASSINATURA_VIVA } from "./tipos";

/** Repositório de pagamentos em memória, para o modo demonstração. */
export class RepositorioPagamentosMemoria implements RepositorioPagamentos {
  private itens = new Map<string, Pagamento>();

  /**
   * Todas as cobranças, para o painel somar o caixa em demonstração.
   *
   * Fica **fora** do contrato `RepositorioPagamentos` de propósito: em
   * produção quem soma é o banco, na view `metricas_caixa`, e obrigar o
   * Postgres a implementar um "traga tudo" que ninguém chama seria
   * convidar alguém a chamá-lo um dia — sobre uma tabela que só cresce.
   */
  todos(): Pagamento[] {
    return [...this.itens.values()];
  }
  private assinaturas = new Map<string, Assinatura>();

  async porId(id: string): Promise<Pagamento | null> {
    return this.itens.get(id) ?? null;
  }

  async porMpPaymentId(mpPaymentId: string): Promise<Pagamento | null> {
    return (
      [...this.itens.values()].find((p) => p.mpPaymentId === mpPaymentId) ??
      null
    );
  }

  async temParcelaAprovada(assinaturaId: string): Promise<boolean> {
    return [...this.itens.values()].some(
      (p) => p.assinaturaId === assinaturaId && p.status === "aprovado",
    );
  }

  async criar(dados: DadosNovaCobranca): Promise<Pagamento> {
    return this.gravarNova(dados, "pendente", null);
  }

  /**
   * O `mpPaymentId` repetido é o que faz este método devolver `null`.
   *
   * Aqui a checagem é uma varredura do `Map`; em Postgres, o índice único
   * de `pagamentos.mp_payment_id`. As duas respondem a mesma pergunta, e é
   * de propósito que a resposta não venha de "leia, decida, grave": o
   * Mercado Pago reenvia o aviso de cobrança recorrente.
   */
  async registrarLiquidada(
    dados: DadosCobrancaLiquidada,
  ): Promise<Pagamento | null> {
    const jaExiste = [...this.itens.values()].some(
      (p) => p.mpPaymentId === dados.mpPaymentId,
    );
    if (jaExiste) return null;

    return this.gravarNova(dados, "aprovado", dados.mpPaymentId);
  }

  private gravarNova(
    dados: DadosNovaCobranca,
    status: StatusPagamento,
    mpPaymentId: string | null,
  ): Pagamento {
    const agora = new Date().toISOString();
    const pagamento: Pagamento = {
      id: crypto.randomUUID(),
      usuarioId: dados.usuarioId,
      tipo: dados.tipo,
      valorCentavos: dados.valorCentavos,
      status,
      mpPreferenceId: null,
      mpPaymentId,
      assinaturaId: dados.assinaturaId ?? null,
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

  /** Parte de `aprovado`: devolução acontece depois de o dinheiro entrar. */
  async estornar(
    id: string,
    mpPaymentId: string | null,
    saida: "estornado" | "contestado" = "estornado",
  ): Promise<Pagamento | null> {
    return this.mudarStatusSe(id, "aprovado", saida, mpPaymentId);
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

  // ── Assinaturas recorrentes ───────────────────────────────────────────

  async assinaturaViva(
    usuarioId: string,
    tipo: TipoPagamento,
  ): Promise<Assinatura | null> {
    const dela = [...this.assinaturas.values()]
      .filter(
        (a) =>
          a.usuarioId === usuarioId &&
          a.tipo === tipo &&
          STATUS_ASSINATURA_VIVA.includes(a.status),
      )
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return dela[0] ?? null;
  }

  async assinaturaPorId(id: string): Promise<Assinatura | null> {
    return this.assinaturas.get(id) ?? null;
  }

  async assinaturaPorMpId(mpPreapprovalId: string): Promise<Assinatura | null> {
    return (
      [...this.assinaturas.values()].find(
        (a) => a.mpPreapprovalId === mpPreapprovalId,
      ) ?? null
    );
  }

  async criarAssinatura(dados: DadosNovaAssinatura): Promise<Assinatura> {
    const agora = new Date().toISOString();
    const assinatura: Assinatura = {
      id: crypto.randomUUID(),
      usuarioId: dados.usuarioId,
      tipo: dados.tipo,
      valorCentavos: dados.valorCentavos,
      status: "pendente",
      mpPreapprovalId: null,
      checkoutUrl: null,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    this.assinaturas.set(assinatura.id, assinatura);
    return assinatura;
  }

  async vincularAssinaturaAoMercadoPago(
    id: string,
    dados: { mpPreapprovalId: string; checkoutUrl: string | null },
  ): Promise<Assinatura> {
    const atual = this.assinaturas.get(id);
    if (!atual) throw erros.naoEncontrado("Assinatura");

    const nova: Assinatura = {
      ...atual,
      mpPreapprovalId: dados.mpPreapprovalId,
      checkoutUrl: dados.checkoutUrl,
      atualizadoEm: new Date().toISOString(),
    };
    this.assinaturas.set(id, nova);
    return nova;
  }

  async definirStatusAssinatura(
    id: string,
    status: StatusAssinatura,
  ): Promise<Assinatura | null> {
    const atual = this.assinaturas.get(id);
    if (!atual) throw erros.naoEncontrado("Assinatura");
    // `cancelada` é terminal, e o status igual não é mudança nenhuma.
    if (atual.status === status || atual.status === "cancelada") return null;

    const nova: Assinatura = {
      ...atual,
      status,
      atualizadoEm: new Date().toISOString(),
    };
    this.assinaturas.set(id, nova);
    return nova;
  }

  limpar(): void {
    this.itens.clear();
    this.assinaturas.clear();
  }
}
