"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  derrubarCacheDePrestadores,
  revalidarBuscaDeVagas,
} from "@/lib/cache-de-listagem";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { clienteDeServico } from "@/lib/supabase/service";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import {
  schemaEdicaoDeCusto,
  schemaIdDeCusto,
  schemaNovoCusto,
} from "@/server/custos/schemas";
import {
  adicionarCusto,
  editarCusto,
  removerCusto,
} from "@/server/custos/servico";
import { decidirDenuncia } from "@/server/denuncias/servico";
import { erros } from "@/server/errors";
import { log } from "@/server/logger";
import {
  schemaIdDeParceria,
  schemaNovaParceria,
} from "@/server/parceiros/schemas";
import {
  autorizarParceiro,
  encerrarParceria,
} from "@/server/parceiros/servico";

export type ReviewDecision = "aprovado" | "reprovado";

export type DecisionResult =
  | { ok: true; demo?: boolean }
  | { ok: false; error: string };

/**
 * Decisão manual sobre um pedido de verificação.
 *
 * Ao decidir, o arquivo do documento é removido do bucket privado: fica só o
 * status no perfil. É a política de retenção descrita nos requisitos de LGPD.
 */
export async function decideVerification(
  requestId: string,
  decision: ReviewDecision,
): Promise<DecisionResult> {
  /*
   * Esta ação é um endpoint por si só: o muro do `proxy.ts` guarda a rota
   * `/admin`, não a chamada. A checagem mora aqui, como em toda ação que
   * muda dado (#360) — quem não é admin não chega nem a ler o pedido.
   */
  const sessao = await sessaoAtual();
  if (!sessao || !pode(sessao.papel, "admin:decidir_verificacao")) {
    return { ok: false, error: "Sem permissão." };
  }

  if (!isSupabaseConfigured) return { ok: true, demo: true };

  /*
   * Chave de serviço (#419). Era o cliente da chave anônima, que não lê
   * `pedidos_verificacao` nem grava em `usuarios` — as duas são fechadas
   * para ela. Toda decisão respondia "Pedido não encontrado", e nada
   * ficava vermelho porque nenhum pedido chegou à fila até hoje (#133). A
   * página que lista a fila já lia com esta chave; a ação que decide
   * ficou para trás.
   */
  const supabase = clienteDeServico();
  if (!supabase) {
    return { ok: false, error: "A chave de serviço não está configurada." };
  }

  const { data: request, error: loadError } = await supabase
    .from("pedidos_verificacao")
    .select("id, usuario_id, documento_path, selfie_path")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError || !request) {
    return { ok: false, error: "Pedido não encontrado." };
  }

  const { error: updateError } = await supabase
    .from("pedidos_verificacao")
    .update({ status: decision, decidido_em: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    return { ok: false, error: "Não foi possível salvar a decisão." };
  }

  await supabase
    .from("usuarios")
    .update({
      status_verificacao: decision,
      doc_verificado: decision === "aprovado",
    })
    .eq("id", String(request.usuario_id));

  // Retenção: as imagens só existem até a decisão.
  const paths = [request.documento_path, request.selfie_path].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  if (paths.length > 0) {
    /*
     * Apagar é a obrigação de retenção, e falhar aqui não pode passar em
     * silêncio: a decisão já foi gravada, e o documento ficaria no bucket
     * sem que ninguém soubesse. Vai ao Sentry, sem os caminhos — eles
     * começam pelo id da pessoa.
     */
    const { error: removeError } = await supabase.storage
      .from("verificacao")
      .remove(paths);
    if (removeError) {
      log.erro(
        erros.indisponivel(
          `documentos de verificação não apagados: ${removeError.message}`,
        ),
        { acao: "admin.decidir_verificacao", arquivos: paths.length },
      );
    }
  }

  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Tirar do ar ou descartar o que foi denunciado (#435).
 *
 * Tirar a vaga do ar a encerra, e a busca precisa saber na hora — o mesmo
 * par de `revalidatePath` e `updateTag` de quando a empresa publica.
 * Tirar a avaliação muda a nota do prestador, que a vitrine guarda em
 * cache.
 */
export const decidirDenunciaAction = criarAcao({
  nome: "denuncia.decidir",
  entrada: z.object({
    alvo: z.enum(["vaga", "avaliacao", "publicacao"]),
    alvoId: z.string().min(1).max(100),
    tirarDoAr: z.boolean(),
  }),
  executar: async (dados) => {
    const fechadas = await decidirDenuncia(await sessaoAtual(), dados);
    if (dados.tirarDoAr) {
      if (dados.alvo === "vaga") revalidarBuscaDeVagas();
      // A foto some da grade do perfil; a nota e a vitrine, na avaliação.
      else derrubarCacheDePrestadores();
    }
    revalidatePath("/admin");
    return { fechadas };
  },
});

/*
 * Os custos mensais do painel (#473). A tela chama com objeto, de dentro do
 * bloco "O Lupa já se paga?", e pede de novo as métricas depois: a
 * cobertura é recalculada no servidor, com a lista que acabou de mudar.
 */
export const adicionarCustoAction = criarAcao({
  nome: "custo.criar",
  entrada: schemaNovoCusto,
  executar: async ({ nome, valor }) => {
    const custo = await adicionarCusto(await sessaoAtual(), {
      nome,
      centavos: valor,
    });
    revalidatePath("/admin/painel");
    return custo;
  },
});

export const editarCustoAction = criarAcao({
  nome: "custo.editar",
  entrada: schemaEdicaoDeCusto,
  executar: async ({ id, nome, valor }) => {
    const custo = await editarCusto(await sessaoAtual(), id, {
      nome,
      centavos: valor,
    });
    revalidatePath("/admin/painel");
    return custo;
  },
});

export const removerCustoAction = criarAcao({
  nome: "custo.remover",
  entrada: schemaIdDeCusto,
  executar: async ({ id }) => {
    await removerCusto(await sessaoAtual(), id);
    revalidatePath("/admin/painel");
    return { id };
  },
});

/*
 * Parcerias (#505). Autorizar pode dar o benefício na hora — a conta já
 * existia e já tinha confirmado o e-mail —, e encerrar pode tirá-lo: as duas
 * mexem na vitrine e na busca de vagas, que guardam a lista em cache.
 */
export const autorizarParceiroAction = criarAcao({
  nome: "parceiro.autorizar",
  entrada: schemaNovaParceria,
  executar: async (dados) => {
    const parceria = await autorizarParceiro(await sessaoAtual(), dados);
    derrubarCacheDePrestadores();
    revalidatePath("/admin/parceiros");
    return { id: parceria.id };
  },
});

export const encerrarParceriaAction = criarAcao({
  nome: "parceiro.encerrar",
  entrada: schemaIdDeParceria,
  executar: async ({ id }) => {
    await encerrarParceria(await sessaoAtual(), id);
    derrubarCacheDePrestadores();
    revalidatePath("/admin/parceiros");
    return { id };
  },
});
