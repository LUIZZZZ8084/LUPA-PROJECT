import type {
  InscricaoPush,
  PreferenciaNotificacao,
  RepositorioNotificacoes,
} from "./tipos";

/**
 * Implementação em memória — modo demonstração e testes.
 *
 * É o mesmo contrato que a de Postgres, e é isso que faz o teste exercitar
 * o caminho que roda em produção.
 */
export class RepositorioNotificacoesMemoria implements RepositorioNotificacoes {
  private preferencias = new Map<string, PreferenciaNotificacao>();
  /** Chaveado por endpoint: é ele que identifica o aparelho. */
  private inscricoes = new Map<string, InscricaoPush>();

  async preferencia(usuarioId: string): Promise<PreferenciaNotificacao | null> {
    return this.preferencias.get(usuarioId) ?? null;
  }

  async salvarPreferencia(pref: PreferenciaNotificacao): Promise<void> {
    this.preferencias.set(pref.usuarioId, { ...pref });
  }

  async removerPreferencia(usuarioId: string): Promise<void> {
    this.preferencias.delete(usuarioId);
  }

  async inscricoesInteressadas(
    cidade: string,
    categoria: string | null,
  ): Promise<InscricaoPush[]> {
    const interessados = new Set(
      [...this.preferencias.values()]
        .filter(
          (p) =>
            p.cidade === cidade &&
            // Sem categoria escolhida, recebe tudo o que sai na cidade dela.
            // Vaga sem categoria só alcança quem pediu tudo.
            (p.categoria === null ||
              (categoria !== null && p.categoria === categoria)),
        )
        .map((p) => p.usuarioId),
    );

    return [...this.inscricoes.values()].filter((i) =>
      interessados.has(i.usuarioId),
    );
  }

  async salvarInscricao(inscricao: InscricaoPush): Promise<void> {
    this.inscricoes.set(inscricao.endpoint, { ...inscricao });
  }

  async removerInscricao(endpoint: string): Promise<void> {
    this.inscricoes.delete(endpoint);
  }

  async inscricoesDe(usuarioId: string): Promise<InscricaoPush[]> {
    return [...this.inscricoes.values()].filter(
      (i) => i.usuarioId === usuarioId,
    );
  }

  /** Só para teste. */
  limpar(): void {
    this.preferencias.clear();
    this.inscricoes.clear();
  }
}
