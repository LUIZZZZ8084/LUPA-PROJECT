import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { clienteDeServico } from "@/lib/supabase/service";
import { type Autenticado, exigirCapacidade } from "../auth/rbac";
import { erros } from "../errors";
import { log } from "../logger";
import { repositorioUsuarios } from "../repositories";

/**
 * Avaliar um prestador.
 *
 * O painel do perfil já convidava — "foi atendido por ele? sua avaliação
 * ajuda a próxima pessoa" — e não havia nada para clicar. A tabela
 * `avaliacoes` existia desde o começo, com o trigger que mantém a média do
 * prestador em dia, e nunca ninguém escreveu nela pela aplicação: as
 * linhas de hoje vieram do seed.
 *
 * **Quem pode avaliar é qualquer conta com sessão.** Decisão do Luiz:
 * entrar já é pré-requisito para usar o app inteiro, então não há portão a
 * mais. O que não se permite é o prestador avaliar a si mesmo, e a mesma
 * pessoa avaliar duas vezes — as duas travas moram no banco, porque
 * checagem só na aplicação perde para dois envios simultâneos.
 */

export interface DadosAvaliacao {
  prestadorId: string;
  nota: number;
  comentario?: string | null;
}

/**
 * Guarda em memória para o modo demonstração.
 *
 * Sem Supabase não há tabela; sem isto, avaliar na demonstração pareceria
 * funcionar e sumiria na navegação seguinte. Vive no módulo, como o
 * repositório de usuários — some quando o processo morre, e é o
 * suficiente para demonstrar.
 */
const emMemoria: {
  prestadorId: string;
  avaliadorId: string;
  nome: string;
  nota: number;
  comentario: string | null;
  criadoEm: string;
}[] = [];

export function avaliacoesEmMemoria(prestadorId: string) {
  return emMemoria.filter((a) => a.prestadorId === prestadorId);
}

export async function jaAvaliou(
  sessao: Autenticado | null,
  prestadorId: string,
): Promise<boolean> {
  if (!sessao) return false;

  if (!isSupabaseConfigured) {
    return emMemoria.some(
      (a) =>
        a.prestadorId === prestadorId && a.avaliadorId === sessao.usuarioId,
    );
  }

  const supabase = clienteDeServico();
  if (!supabase) return false;

  const { data } = await supabase
    .from("avaliacoes")
    .select("id")
    .eq("prestador_id", prestadorId)
    .eq("avaliador_id", sessao.usuarioId)
    .maybeSingle();

  return Boolean(data);
}

export async function avaliarPrestador(
  sessao: Autenticado | null,
  dados: DadosAvaliacao,
): Promise<void> {
  const autenticado = exigirCapacidade(sessao, "avaliacao:escrever");

  if (autenticado.usuarioId === dados.prestadorId) {
    throw erros.validacao(
      [{ campo: "nota", mensagem: "Você não pode avaliar o próprio perfil." }],
      "Você não pode avaliar o próprio perfil.",
    );
  }

  if (!Number.isInteger(dados.nota) || dados.nota < 1 || dados.nota > 5) {
    throw erros.validacao([
      { campo: "nota", mensagem: "Escolha de 1 a 5 estrelas." },
    ]);
  }

  if (await jaAvaliou(autenticado, dados.prestadorId)) {
    throw erros.conflito(
      "Você já avaliou este profissional. Cada pessoa avalia uma vez.",
    );
  }

  const usuario = await repositorioUsuarios().porId(autenticado.usuarioId);
  if (!usuario) throw erros.naoEncontrado("Usuário");

  const comentario = dados.comentario?.trim() || null;

  if (!isSupabaseConfigured) {
    emMemoria.push({
      prestadorId: dados.prestadorId,
      avaliadorId: autenticado.usuarioId,
      nome: usuario.nomeCompleto,
      nota: dados.nota,
      comentario,
      criadoEm: new Date().toISOString(),
    });
  } else {
    const supabase = clienteDeServico();
    if (!supabase) throw erros.indisponivel("cliente de banco");

    const { error } = await supabase.from("avaliacoes").insert({
      prestador_id: dados.prestadorId,
      avaliador_id: autenticado.usuarioId,
      /*
       * O nome é gravado junto, e não só o id: a tela lista avaliações sem
       * consultar `usuarios`, que é fechada para a chave anônima. Guardar
       * o nome do momento também é o comportamento certo — a avaliação é
       * um registro do que aconteceu naquele dia.
       */
      nome_avaliador: usuario.nomeCompleto,
      nota: dados.nota,
      comentario,
    });

    if (error) {
      /*
       * O índice único é a garantia de verdade contra dois envios
       * simultâneos; a checagem acima só serve para dar mensagem decente
       * antes de tentar. Quando a corrida acontece, é aqui que ela cai.
       */
      if (error.code === "23505") {
        throw erros.conflito(
          "Você já avaliou este profissional. Cada pessoa avalia uma vez.",
        );
      }
      throw erros.indisponivel(`avaliação: ${error.message}`);
    }
  }

  log.info("prestador avaliado", {
    acao: "avaliacao.criar",
    papel: autenticado.papel,
    nota: dados.nota,
  });
}
