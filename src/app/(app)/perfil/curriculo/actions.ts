"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { exigirCapacidade } from "@/server/auth/rbac";
import { comprar } from "@/server/pagamentos/servico";

/**
 * Compra o gerador de currículo (#47) — pagamento único, não assinatura.
 *
 * Com o Mercado Pago configurado, sai daqui direto para o Checkout Pro —
 * `redirect()` para uma URL externa é implementado como exceção, e
 * `criarAcao` já sabe deixar passar sem virar mensagem de erro. Sem o
 * Mercado Pago, a compra já volta aprovada e o redirect só leva à tela de
 * retorno, que confirma.
 */
export const comprarGeradorCurriculo = criarAcao({
  nome: "candidato.comprar_gerador_curriculo",
  entrada: z.object({}),
  executar: async () => {
    const sessao = await sessaoAtual();
    exigirCapacidade(sessao, "candidato:gerar_curriculo");

    const { checkoutUrl, pagamento } = await comprar(sessao, "curriculo_pdf");

    revalidatePath("/perfil/curriculo");
    revalidatePath("/perfil");

    redirect(checkoutUrl ?? `/pagamento/retorno?compra=${pagamento.id}`);
  },
});
