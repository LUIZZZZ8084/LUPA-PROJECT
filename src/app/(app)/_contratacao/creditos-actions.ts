"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { criarAcao } from "@/server/action";
import { sessaoAtual } from "@/server/auth/cookies";
import { exigirCapacidade } from "@/server/auth/rbac";
import { erros } from "@/server/errors";
import { ehRecorrente } from "@/server/pagamentos/planos";
import {
  assinar,
  cancelarPlanoDeVagas,
  comprar,
} from "@/server/pagamentos/servico";
import { BASES_DE_CONTRATACAO } from "./area";

/**
 * Revalida o painel das **duas** áreas de contratação.
 *
 * A action não sabe de qual porta veio o clique — `/empresa` ou
 * `/contratar` —, e não precisa saber: revalidar um caminho que a pessoa
 * não está vendo não custa nada, e deixar de revalidar o certo faz a tela
 * mentir sobre o que acabou de acontecer. Escrever `/empresa` à mão aqui
 * era o defeito silencioso que a #189 quase deixou passar.
 */
function revalidarContratacao(sufixo = "") {
  for (const base of BASES_DE_CONTRATACAO) revalidatePath(`${base}${sufixo}`);
}

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
  "empresa_plano_5",
  "empresa_plano_10",
  "empresa_mensal",
]);

/**
 * Compra uma vaga avulsa, ou assina um plano (#172, #489).
 *
 * Os dois caminhos moram na mesma action porque, para quem clica, é o
 * mesmo gesto — escolher uma opção e pagar. A diferença entre pagamento
 * único e assinatura é do Mercado Pago, e é o servidor que decide qual,
 * a partir do tipo: `ehRecorrente` manda os planos para `preapproval` e o
 * resto para o Checkout Pro.
 */
export const comprarCreditos = criarAcao({
  nome: "empresa.comprar_creditos",
  entrada: z.object({ tipo: COMPRAVEL }),
  executar: async ({ tipo }) => {
    const sessao = await sessaoAtual();
    exigirCapacidade(sessao, "vaga:publicar");

    if (ehRecorrente(tipo)) {
      const { checkoutUrl, assinatura } = await assinar(sessao, tipo);
      revalidarContratacao("/creditos");
      revalidarContratacao();
      redirect(checkoutUrl ?? `/pagamento/retorno?assinatura=${assinatura.id}`);
    }

    const { checkoutUrl, pagamento } = await comprar(sessao, tipo);
    revalidarContratacao("/creditos");
    revalidarContratacao();
    redirect(checkoutUrl ?? `/pagamento/retorno?compra=${pagamento.id}`);
  },
});

/**
 * Cancela a renovação do plano de vagas (#489).
 *
 * Cancelar interrompe as cobranças futuras e **não** tira os dias já
 * pagos: o plano segue valendo até o fim do período. É também o primeiro
 * passo de quem quer trocar de plano — assinar outro com um ativo é
 * recusado até aqui.
 */
export const cancelarPlano = criarAcao({
  nome: "empresa.cancelar_plano",
  entrada: z.object({}),
  executar: async () => {
    const sessao = await sessaoAtual();
    exigirCapacidade(sessao, "vaga:publicar");

    const resultado = await cancelarPlanoDeVagas(sessao);
    if (!resultado.ok) {
      throw erros.validacao([
        { campo: "renovacao", mensagem: resultado.motivo },
      ]);
    }

    revalidarContratacao("/creditos");
    revalidarContratacao();
    return {};
  },
});
