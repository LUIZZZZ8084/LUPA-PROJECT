"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { erros } from "@/server/errors";
import {
  assinar,
  cancelarRenovacao,
  pedirEstorno,
} from "@/server/pagamentos/servico";

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
    const resultado = await cancelarRenovacao(await sessaoAtual());

    if (!resultado.ok)
      throw erros.validacao([
        { campo: "renovacao", mensagem: resultado.motivo },
      ]);

    revalidatePath("/perfil/assinatura");
    revalidatePath("/perfil");
    return {};
  },
});

/**
 * Devolve o dinheiro da primeira cobrança, a pedido de quem pagou (#168,
 * com o prazo e o alcance revistos na #170).
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
