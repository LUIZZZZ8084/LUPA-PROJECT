import { repositorioCandidaturas } from "../candidaturas";
import { repositorioVagas } from "../vagas";
import {
  diasAte,
  montarSerie,
  type PontoDaSerie,
  type RepositorioVisualizacoes,
} from "./tipos";

/**
 * Visualizações em memória, para o modo demonstração.
 *
 * As candidaturas vêm do repositório de candidaturas, o mesmo que a
 * demonstração usa para tudo — assim o gráfico responde a uma candidatura
 * feita ali na hora, que é o ponto de demonstrar.
 */
export class RepositorioVisualizacoesMemoria
  implements RepositorioVisualizacoes
{
  /** `vagaId` → `dia` → total. */
  private readonly contagens = new Map<string, Map<string, number>>();

  /** Vagas que já receberam histórico de demonstração. */
  private readonly semeadas = new Set<string>();

  private hoje(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private somar(vagaId: string, dia: string, quanto: number): void {
    const porDia = this.contagens.get(vagaId) ?? new Map<string, number>();
    porDia.set(dia, (porDia.get(dia) ?? 0) + quanto);
    this.contagens.set(vagaId, porDia);
  }

  async registrar(vagaId: string): Promise<void> {
    this.somar(vagaId, this.hoje(), 1);
  }

  /**
   * Histórico fictício para a vaga, uma vez só.
   *
   * Sem isto o gráfico da demonstração seria uma linha zerada até alguém
   * abrir uma vaga na mesma sessão — e demonstração que mostra tela vazia
   * não demonstra nada. Vive aqui, e não em `mock-data.ts`, porque a regra
   * de arquitetura só deixa `src/lib/data.ts` ler aquele arquivo.
   *
   * O número é derivado do id da vaga e da data, então o gráfico é o mesmo
   * a cada recarga: número que dança sozinho a cada F5 faz quem está vendo
   * duvidar de todo o resto da tela.
   */
  private semear(vagaId: string, dias: string[]): void {
    if (this.semeadas.has(vagaId)) return;
    this.semeadas.add(vagaId);

    for (const dia of dias) {
      this.somar(vagaId, dia, 3 + (embaralhar(`${vagaId}:${dia}`) % 12));
    }
  }

  async serieDaEmpresa(
    empresaId: string,
    dias: number,
  ): Promise<PontoDaSerie[]> {
    const janela = diasAte(new Date(), dias);
    const vagas = await repositorioVagas().porEmpresa(empresaId);

    // Só as vagas que já existiam antes desta sessão ganham histórico. Uma
    // vaga publicada agora, na demonstração, deve começar do zero — senão
    // quem acabou de publicar vê 200 visualizações de ontem.
    for (const vaga of vagas) {
      const nascidaAgora =
        vaga.criadoEm.slice(0, 10) === janela[janela.length - 1];
      if (!nascidaAgora) this.semear(vaga.id, janela);
    }

    const idsDaEmpresa = new Set(vagas.map((v) => v.id));

    const visualizacoes = new Map<string, number>();
    for (const [vagaId, porDia] of this.contagens) {
      if (!idsDaEmpresa.has(vagaId)) continue;
      for (const [dia, total] of porDia) {
        visualizacoes.set(dia, (visualizacoes.get(dia) ?? 0) + total);
      }
    }

    const candidaturas = new Map<string, number>();
    for (const vagaId of idsDaEmpresa) {
      for (const c of await repositorioCandidaturas().porVaga(vagaId)) {
        const dia = c.criadoEm.slice(0, 10);
        candidaturas.set(dia, (candidaturas.get(dia) ?? 0) + 1);
      }
    }

    return montarSerie(janela, visualizacoes, candidaturas);
  }
}

/** Hash pequeno e estável (FNV-1a), só para gerar número repetível. */
function embaralhar(chave: string): number {
  let h = 2166136261;
  for (let i = 0; i < chave.length; i++) {
    h ^= chave.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
