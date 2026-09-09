"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { criarCobranca } from "@/server/pagamentos/servico";

/**
 * Assina ou renova a mensalidade de prestador.
 *
 * Com o Mercado Pago configurado, sai daqui direto para o Checkout Pro —
 * `redirect()` para uma URL externa é implementado como exceção, do
 * mesmo jeito que `redirect()` interno, e `criarAcao` já sabe deixar os
 * dois passarem sem virar mensagem de erro.
 *
 * Sem o Mercado Pago configurado, a cobrança já volta aprovada — o
 * redirect só leva de volta para a própria tela, que mostra o novo
 * prazo.
 */
export const assinarMensalidade = criarAcao({
  nome: "prestador.assinar_mensalidade",
  entrada: z.object({}),
  executar: async () => {
    const sessao = await sessaoAtual();
    const { checkoutUrl, pagamento } = await criarCobranca(
      sessao,
      "prestador_mensalidade",
    );

    revalidatePath("/perfil/assinatura");
    revalidatePath("/perfil");

    redirect(checkoutUrl ?? `/pagamento/retorno?id=${pagamento.id}`);
  },
});
