/**
 * Visitas ao perfil e chamadas no WhatsApp de cada prestador (#604).
 *
 * O prestador paga a mensalidade e não via retorno nenhum dentro do app. A
 * mesma forma das visualizações de vaga: contagem por dia, sem guardar
 * quem — saber quem procurou eletricista é histórico de pessoa.
 */
export type EventoDoPerfil = "visita" | "contato";

export interface TotaisDoPerfil {
  visitas: number;
  contatos: number;
}

export interface RepositorioContagensPrestador {
  /** Soma um evento no dia de hoje. Não recebe quem, de propósito. */
  registrar(prestadorId: string, evento: EventoDoPerfil): Promise<void>;

  /** Totais dos últimos `dias` dias, contando hoje. */
  totais(prestadorId: string, dias: number): Promise<TotaisDoPerfil>;
}

/** O primeiro dia da janela, em `YYYY-MM-DD` (UTC, como o `current_date`). */
export function inicioDaJanela(hoje: Date, dias: number): string {
  const d = new Date(hoje);
  d.setUTCDate(d.getUTCDate() - (dias - 1));
  return d.toISOString().slice(0, 10);
}
