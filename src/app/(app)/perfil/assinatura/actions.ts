"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { erros } from "@/server/errors";
import { criarCobranca, pedirEstorno } from "@/server/pagamentos/servico";

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

/**
 * Devolve o dinheiro, a pedido de quem pagou (#168).
 *
 * Não recebe o id da cobrança: ele sai da sessão, no serviço. Aceitar um
 * id daqui deixaria alguém mandar estornar a cobrança de outra pessoa.
 *
 * O resultado volta para a tela em vez de redirecionar: a pessoa está
 * olhando para o próprio estado de assinatura, e é ali que a mudança
 * precisa aparecer.
 */
export const estornarMensalidade = criarAcao({
  nome: "prestador.estornar_mensalidade",
  entrada: z.object({}),
  executar: async () => {
    const resultado = await pedirEstorno(await sessaoAtual());

    if (!resultado.ok)
      throw erros.validacao([{ campo: "estorno", mensagem: resultado.motivo }]);

    revalidatePath("/perfil/assinatura");
    revalidatePath("/perfil");
    return {};
  },
});
