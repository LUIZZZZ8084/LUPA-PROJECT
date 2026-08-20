import { erros } from "../errors";
import {
  type DadosNovaPublicacao,
  LIMITE_PUBLICACOES_ATIVAS,
  type Publicacao,
  type RepositorioPublicacoes,
  type StatusPublicacao,
} from "./tipos";

/**
 * Repositório de publicações em memória.
 *
 * Reproduz o limite de ativas do mesmo jeito que o trigger do Postgres, para
 * que o teste do limite exercite a mesma regra que roda em produção.
 */
export class RepositorioPublicacoesMemoria implements RepositorioPublicacoes {
  private itens = new Map<string, Publicacao>();

  async porAutor(
    autorId: string,
    status?: StatusPublicacao,
  ): Promise<Publicacao[]> {
    return [...this.itens.values()]
      .filter((p) => p.autorId === autorId && (!status || p.status === status))
      .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm));
  }

  async porId(id: string): Promise<Publicacao | null> {
    return this.itens.get(id) ?? null;
  }

  async contarAtivas(autorId: string): Promise<number> {
    return [...this.itens.values()].filter(
      (p) => p.autorId === autorId && p.status === "ativa",
    ).length;
  }

  async criar(dados: DadosNovaPublicacao): Promise<Publicacao> {
    if ((await this.contarAtivas(dados.autorId)) >= LIMITE_PUBLICACOES_ATIVAS) {
      throw new Error("limite de publicações ativas atingido");
    }

    const agora = new Date().toISOString();
    const publicacao: Publicacao = {
      id: crypto.randomUUID(),
      autorId: dados.autorId,
      titulo: dados.titulo,
      corpo: dados.corpo,
      imagemUrl: dados.imagemUrl ?? null,
      status: "ativa",
      criadoEm: agora,
      atualizadoEm: agora,
    };

    this.itens.set(publicacao.id, publicacao);
    return publicacao;
  }

  async atualizar(
    id: string,
    campos: Partial<Pick<Publicacao, "titulo" | "corpo" | "imagemUrl">>,
  ): Promise<Publicacao> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Publicação");

    const novo: Publicacao = {
      ...atual,
      ...campos,
      atualizadoEm: new Date().toISOString(),
    };
    this.itens.set(id, novo);
    return novo;
  }

  async definirStatus(
    id: string,
    status: StatusPublicacao,
  ): Promise<Publicacao> {
    const atual = this.itens.get(id);
    if (!atual) throw erros.naoEncontrado("Publicação");

    // Reativar também passa pelo limite: senão o arquivo vira um jeito de
    // burlar a regra.
    if (
      status === "ativa" &&
      atual.status !== "ativa" &&
      (await this.contarAtivas(atual.autorId)) >= LIMITE_PUBLICACOES_ATIVAS
    ) {
      throw new Error("limite de publicações ativas atingido");
    }

    const novo: Publicacao = {
      ...atual,
      status,
      atualizadoEm: new Date().toISOString(),
    };
    this.itens.set(id, novo);
    return novo;
  }

  limpar(): void {
    this.itens.clear();
  }
}
