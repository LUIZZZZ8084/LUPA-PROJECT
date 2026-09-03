import { enviarArquivo, temArmazenamento } from "../arquivos/servico";
import { type Autenticado, exigirCapacidade, exigirDono } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioPublicacoes } from "./index";
import {
  LIMITE_PUBLICACOES_ATIVAS,
  type Publicacao,
  type StatusPublicacao,
} from "./tipos";

/**
 * Regras de publicação de perfil.
 *
 * Cada operação faz duas perguntas, sempre nesta ordem: o papel pode fazer
 * isto? e este registro é desta pessoa? Só a primeira deixaria qualquer
 * empresa autenticada editar a publicação de qualquer outra.
 */

export async function listarPublicacoes(
  autorId: string,
  status?: StatusPublicacao,
): Promise<Publicacao[]> {
  return repositorioPublicacoes().porAutor(autorId, status);
}

export interface ResumoPublicacoes {
  ativas: number;
  limite: number;
  restantes: number;
}

export async function resumo(autorId: string): Promise<ResumoPublicacoes> {
  const ativas = await repositorioPublicacoes().contarAtivas(autorId);
  return {
    ativas,
    limite: LIMITE_PUBLICACOES_ATIVAS,
    restantes: Math.max(0, LIMITE_PUBLICACOES_ATIVAS - ativas),
  };
}

export async function criarPublicacao(
  sessao: Autenticado | null,
  dados: { titulo: string; corpo: string; imagemUrl?: string | null },
): Promise<Publicacao> {
  const autenticado = exigirCapacidade(sessao, "publicacao:criar");
  const repo = repositorioPublicacoes();

  const ativas = await repo.contarAtivas(autenticado.usuarioId);

  if (ativas >= LIMITE_PUBLICACOES_ATIVAS) {
    /*
     * A mensagem diz o que fazer. "Limite atingido" sozinho deixa a pessoa
     * sem saída aparente; dizer "arquive uma" mostra o caminho, e arquivar
     * não perde o conteúdo.
     */
    throw erros.limiteExcedido(
      `Você já tem ${LIMITE_PUBLICACOES_ATIVAS} publicações ativas. ` +
        "Arquive uma para publicar outra — nada é apagado.",
      { ativas, limite: LIMITE_PUBLICACOES_ATIVAS },
    );
  }

  const publicacao = await repo.criar({
    autorId: autenticado.usuarioId,
    titulo: dados.titulo,
    corpo: dados.corpo,
    imagemUrl: dados.imagemUrl ?? null,
  });

  log.info("publicação criada", {
    acao: "publicacao.criar",
    papel: autenticado.papel,
    ativas: ativas + 1,
  });

  return publicacao;
}

/**
 * Publica um trabalho com a foto dele, num passo só.
 *
 * A foto vai para o Storage antes de a linha existir, e é de propósito: se
 * o banco falhar depois, sobra um objeto órfão no bucket — invisível e
 * barato. Na ordem inversa, a publicação apontaria para um arquivo que não
 * existe e o feed mostraria imagem quebrada para quem abrisse o perfil. É
 * o mesmo raciocínio já registrado para foto de perfil e currículo.
 *
 * Sem Storage — modo demonstração — a publicação nasce sem foto em vez de
 * recusar: o feed continua demonstrável, e a tela diz que o envio de
 * imagem depende do Supabase.
 */
export async function publicarTrabalho(
  sessao: Autenticado | null,
  dados: { titulo: string; corpo: string; foto?: File | null },
): Promise<Publicacao> {
  const autenticado = exigirCapacidade(sessao, "publicacao:criar");

  let imagemUrl: string | null = null;

  if (dados.foto && dados.foto.size > 0 && temArmazenamento) {
    const { referencia } = await enviarArquivo(
      autenticado.usuarioId,
      "publicacao",
      dados.foto,
    );
    imagemUrl = referencia;
  }

  return criarPublicacao(sessao, {
    titulo: dados.titulo,
    corpo: dados.corpo,
    imagemUrl,
  });
}

export async function editarPublicacao(
  sessao: Autenticado | null,
  id: string,
  campos: { titulo?: string; corpo?: string; imagemUrl?: string | null },
): Promise<Publicacao> {
  const autenticado = exigirCapacidade(sessao, "publicacao:editar_propria");

  const atual = await repositorioPublicacoes().porId(id);
  if (!atual) throw erros.naoEncontrado("Publicação");
  exigirDono(autenticado, atual.autorId, "Publicação");

  return repositorioPublicacoes().atualizar(id, campos);
}

export async function arquivarPublicacao(
  sessao: Autenticado | null,
  id: string,
): Promise<Publicacao> {
  return mudarStatus(sessao, id, "arquivada");
}

export async function reativarPublicacao(
  sessao: Autenticado | null,
  id: string,
): Promise<Publicacao> {
  return mudarStatus(sessao, id, "ativa");
}

async function mudarStatus(
  sessao: Autenticado | null,
  id: string,
  status: StatusPublicacao,
): Promise<Publicacao> {
  const autenticado = exigirCapacidade(sessao, "publicacao:arquivar_propria");
  const repo = repositorioPublicacoes();

  const atual = await repo.porId(id);
  if (!atual) throw erros.naoEncontrado("Publicação");
  exigirDono(autenticado, atual.autorId, "Publicação");

  // Reativar conta para o limite: sem isso, arquivar viraria um jeito de
  // manter vinte publicações e alternar quais aparecem.
  if (status === "ativa" && atual.status !== "ativa") {
    const ativas = await repo.contarAtivas(atual.autorId);
    if (ativas >= LIMITE_PUBLICACOES_ATIVAS) {
      throw erros.limiteExcedido(
        `Você já tem ${LIMITE_PUBLICACOES_ATIVAS} publicações ativas. ` +
          "Arquive outra antes de reativar esta.",
        { ativas, limite: LIMITE_PUBLICACOES_ATIVAS },
      );
    }
  }

  return repo.definirStatus(id, status);
}
