import { reconciliarPagamentosPendentes } from "@/server/pagamentos/servico";
import { executarVarredura } from "../executar";

/**
 * A rede de proteção do webhook, disparada pelo cron da Vercel (#198).
 *
 * O caminho normal de uma cobrança é a notificação do Mercado Pago, que
 * chega em segundos. Esta rota existe para o dia em que ela **não** chega:
 * em 10/09/2026 o aviso da primeira venda de verdade foi entregue e nós o
 * recusamos com 401, por segredo divergente. O dinheiro entrou, a cobrança
 * ficou `pendente` para sempre, e não havia nenhum caminho para o app
 * descobrir isso sozinho.
 *
 * A regra de negócio inteira mora em `reconciliarPagamentosPendentes`; o
 * portão, o log e o registro que o painel do admin lê, em
 * `executarVarredura` (#566). Esta rota mexe em dinheiro e não pode ficar
 * aberta na internet.
 *
 * **O portão é `CRON_SECRET`**, que a Vercel manda como `Authorization:
 * Bearer` quando a variável existe. Sem ela configurada em produção, a rota
 * recusa — e **grita no log**, em vez de deixar passar. É a lição da #196:
 * falha fechada está certa, silenciosa não. Uma varredura que nunca roda
 * porque ninguém configurou o segredo seria exatamente o defeito que ela
 * veio consertar, de novo.
 */

export const dynamic = "force-dynamic";
/** Varredura fala com o Mercado Pago uma vez por cobrança presa. */
export const maxDuration = 60;

export function GET(request: Request) {
  return executarVarredura(request, {
    nome: "reconciliar-pagamentos",
    acao: "pagamentos.reconciliar",
    concluida: "varredura concluída",
    rodar: () => reconciliarPagamentosPendentes(),
  });
}
