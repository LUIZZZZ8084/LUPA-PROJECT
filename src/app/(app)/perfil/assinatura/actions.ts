"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { erros } from "@/server/errors";
import { assinar, cancelarRenovacao } from "@/server/pagamentos/servico";

/**
 * Assina a mensalidade de prestador, com renovação automática.
 *
 * Com o Mercado Pago configurado, sai daqui direto para o checkout de
 * assinatura — `redirect()` para uma URL externa é implementado como
 * exceção, do mesmo jeito que `redirect()` interno, e `criarAcao` já sabe
 * deixar os dois passarem sem virar mensagem de erro.
 *
 * Sem o Mercado Pago configurado, a assinatura já volta ativa — o
 * redirect só leva à tela de retorno, que mostra a confirmação.
 */
export const assinarMensalidade = criarAcao({
  nome: "prestador.assinar_mensalidade",
  entrada: z.object({}),
  executar: async () => {
    const sessao = await sessaoAtual();
    const { checkoutUrl, assinatura } = await assinar(
      sessao,
      "prestador_mensalidade",
    );

    revalidatePath("/perfil/assinatura");
    revalidatePath("/perfil");

    redirect(checkoutUrl ?? `/pagamento/retorno?assinatura=${assinatura.id}`);
  },
});

/**
 * Cancela a renovação automática (#170).
 *
 * Não devolve nada e não mexe na mensalidade: os dias já pagos continuam
 * valendo até o fim do período. Quem quer o dinheiro de volta usa a
 * devolução, que é outra coisa e tem outras regras.
 */
export const cancelarRenovacaoMensal = criarAcao({
  nome: "prestador.cancelar_renovacao",
  entrada: z.object({}),
  executar: async () => {
    const resultado = await cancelarRenovacao(
      await sessaoAtual(),
      "prestador_mensalidade",
    );

    if (!resultado.ok)
      throw erros.validacao([
        { campo: "renovacao", mensagem: resultado.motivo },
      ]);

    revalidatePath("/perfil/assinatura");
    revalidatePath("/perfil");
    return {};
  },
});
