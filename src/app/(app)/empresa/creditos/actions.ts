"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { exigirCapacidade } from "@/server/auth/rbac";
import { assinar, comprar } from "@/server/pagamentos/servico";

/**
 * Os quatro tipos que esta tela vende, e nada além disso.
 *
 * O tipo vem do formulário, então precisa ser validado como qualquer
 * entrada de cliente — sem este `enum`, alguém postaria
 * `prestador_mensalidade` daqui e compraria a mensalidade de outro
 * domínio pela tela errada. É a mesma regra do "papel vem da sessão,
 * nunca do formulário".
 */
const COMPRAVEL = z.enum([
  "empresa_vaga_avulsa",
  "empresa_pacote_5",
  "empresa_pacote_10",
  "empresa_mensal",
]);

/**
 * Compra crédito de vaga, ou assina o plano mensal (#172).
 *
 * Os dois caminhos moram na mesma action porque, para quem clica, é o
 * mesmo gesto — escolher uma opção e pagar. A diferença entre pagamento
 * único e assinatura é do Mercado Pago, e é o servidor que decide qual,
 * a partir do tipo: `ehRecorrente` manda o mensal para `preapproval` e o
 * resto para o Checkout Pro.
 */
export const comprarCreditos = criarAcao({
  nome: "empresa.comprar_creditos",
  entrada: z.object({ tipo: COMPRAVEL }),
  executar: async ({ tipo }) => {
    const sessao = await sessaoAtual();
    exigirCapacidade(sessao, "vaga:publicar");

    if (tipo === "empresa_mensal") {
      const { checkoutUrl, assinatura } = await assinar(sessao, tipo);
      revalidatePath("/empresa/creditos");
      revalidatePath("/empresa");
      redirect(checkoutUrl ?? `/pagamento/retorno?assinatura=${assinatura.id}`);
    }

    const { checkoutUrl, pagamento } = await comprar(sessao, tipo);
    revalidatePath("/empresa/creditos");
    revalidatePath("/empresa");
    redirect(checkoutUrl ?? `/pagamento/retorno?compra=${pagamento.id}`);
  },
});
