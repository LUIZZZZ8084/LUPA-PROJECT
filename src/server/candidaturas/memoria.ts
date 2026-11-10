import { erros } from "../errors";
import type {
  Candidatura,
  DadosNovaCandidatura,
  EventoDoHistorico,
  RepositorioCandidaturas,
  StatusCandidatura,
} from "./tipos";

/**
 * Repositório de candidaturas em memória, para o modo demonstração.
 *
 * `semear` existe pelo mesmo motivo que em `RepositorioVagasMemoria`: o
 * painel da empresa precisa mostrar candidaturas desde o primeiro acesso.
 * Chamadas seguintes não fazem nada, para não apagar o que já mudou de
 * estágio na demonstração.
 */
export class RepositorioCandidaturasMemoria implements RepositorioCandidaturas {
  private itens = new Map<string, Candidatura>();
  private historico: EventoDoHistorico[] = [];

  semear(candidaturas: Candidatura[]): void {
    if (this.itens.size > 0) return;
    for (const c of candidaturas) this.itens.set(c.id, c);
  }

  /** Todas as candidaturas, para o funil do painel em demonstração (#471). */
  todas(): Candidatura[] {
    return [...this.itens.values()];
  }

  async porId(id: string): Promise<Candidatura | null> {
    return this.itens.get(id) ?? null;
  }

  async porVaga(vagaId: string): Promise<Candidatura[]> {
    return [...this.itens.values()]
      .filter((c) => c.vagaId === vagaId)
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm));
  }

  async porCandidato(candidatoId: string): Promise<Candidatura[]> {
    return [...this.itens.values()]
      .filter((c) => c.candidatoId === candidatoId)
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm));
  }

  async listar(): Promise<Candidatura[]> {
    return [...this.itens.values()].sort(
      (a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm),
    );
  }

  async criar(dados: DadosNovaCandidatura): Promise<Candidatura> {
    const jaExiste = [...this.itens.values()].some(
      (c) => c.vagaId === dados.vagaId && c.candidatoId === dados.candidatoId,
    );
    if (jaExiste) throw erros.conflito("Você já se candidatou a esta vaga.");

    const candidatura: Candidatura = {
      id: crypto.randomUUID(),
      vagaId: dados.vagaId,
      candidatoId: dados.candidatoId,
      status: "enviada",
      criadoEm: new Date().toISOString(),
      respostas: dados.respostas ?? null,
    };

    this.itens.set(candidatura.id, candidatura);
    return candidatura;
  }

  async moverEstagio(
    id: string,
    status: StatusCandidatura,
    autorId: string | null,
  ): Promise<Candidatura> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Candidatura");
    // Como a função do banco: mover para onde já está não grava nada.
    if (atual.status === status) return atual;

    const nova: Candidatura = { ...atual, status };
    this.itens.set(id, nova);
    this.historico.push({
      id: crypto.randomUUID(),
      candidaturaId: id,
      tipo: "etapa",
      de: atual.status,
      para: status,
      autorId,
      criadoEm: new Date().toISOString(),
    });
    return nova;
  }

  async historicoDe(candidaturaId: string): Promise<EventoDoHistorico[]> {
    return this.historico
      .filter((e) => e.candidaturaId === candidaturaId)
      .reverse();
  }

  async ultimasMovimentacoes(
    candidaturaIds: readonly string[],
  ): Promise<Map<string, string>> {
    const ids = new Set(candidaturaIds);
    const ultimas = new Map<string, string>();
    // O histórico cresce em ordem: a última ocorrência é a mais recente.
    for (const e of this.historico) {
      if (ids.has(e.candidaturaId)) ultimas.set(e.candidaturaId, e.criadoEm);
    }
    return ultimas;
  }

  limpar(): void {
    this.itens.clear();
    this.historico = [];
  }
}
