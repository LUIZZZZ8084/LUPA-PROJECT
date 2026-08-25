import { erros } from "../errors";
import type {
  Candidatura,
  DadosNovaCandidatura,
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

  semear(candidaturas: Candidatura[]): void {
    if (this.itens.size > 0) return;
    for (const c of candidaturas) this.itens.set(c.id, c);
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
    };

    this.itens.set(candidatura.id, candidatura);
    return candidatura;
  }

  async moverEstagio(
    id: string,
    status: StatusCandidatura,
  ): Promise<Candidatura> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Candidatura");

    const nova: Candidatura = { ...atual, status };
    this.itens.set(id, nova);
    return nova;
  }

  limpar(): void {
    this.itens.clear();
  }
}
