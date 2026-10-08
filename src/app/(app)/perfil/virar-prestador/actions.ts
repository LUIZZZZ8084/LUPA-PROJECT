"use server";

import { revalidatePath } from "next/cache";
import { derrubarCacheDePrestadores } from "@/lib/cache-de-listagem";
import { criarAcao } from "@/server/action";
import { temArmazenamento } from "@/server/arquivos/servico";
import { criarSessao, sessaoAtual } from "@/server/auth/cookies";
import { derrubarCacheDeRevogacoes } from "@/server/auth/revogacao";
import { erros } from "@/server/errors";
import { schemaAtivacaoPrestador } from "@/server/prestadores/schemas";
import { virarPrestador } from "@/server/prestadores/servico";

/**
 * Ativar o lado prestador da conta que já está logada.
 *
 * O id vem da sessão, nunca do formulário — mesma regra do resto do
 * perfil: não existe alvo para trocar num campo escondido.
 *
 * **A sessão é reemitida na mesma ação.** O papel viaja dentro do JWT, e a
 * validade é de 7 dias: sem reemitir, a pessoa continuaria com as
 * capacidades de candidato até o token vencer — podendo se candidatar a
 * vagas depois de ter virado prestador, que é exatamente o que a troca
 * deveria ter encerrado.
 */
export const ativarPrestador = criarAcao({
  nome: "prestador.ativar",
  entrada: schemaAtivacaoPrestador,
  executar: async (dados) => {
    const sessao = await sessaoAtual();
    if (!sessao) throw erros.naoAutenticado();

    const { papel } = await virarPrestador(sessao, dados, {
      temArmazenamento,
    });

    // O corte já foi gravado com a troca de papel (#352). O cache dele dura
    // 60 s e precisa cair antes da sessão nova, ou ela nasceria dentro da
    // janela em que o corte ainda não é visto.
    derrubarCacheDeRevogacoes();
    await criarSessao(sessao.usuarioId, papel);

    /*
     * O layout inteiro depende do papel: menu, atalhos do perfil, o que a
     * home oferece. Sem revalidar, a pessoa continuaria vendo a interface
     * de candidato até navegar para longe o bastante.
     */
    revalidatePath("/", "layout");
    // Ativar o papel muda quem a vitrine pode mostrar (#206).
    derrubarCacheDePrestadores();

    return { papel };
  },
});

export interface EstadoAtivacao {
  ok?: boolean;
  erro?: string;
  campos?: Record<string, string>;
}

export async function ativarPrestadorComEstado(
  _anterior: EstadoAtivacao,
  formData: FormData,
): Promise<EstadoAtivacao> {
  const resposta = await ativarPrestador(formData);
  if (resposta.ok) return { ok: true };

  return {
    erro: resposta.mensagem,
    campos: Object.fromEntries(
      (resposta.campos ?? []).map((c) => [c.campo, c.mensagem]),
    ),
  };
}
