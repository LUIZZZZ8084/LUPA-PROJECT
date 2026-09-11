import { NextResponse } from "next/server";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { reconciliarPagamentosPendentes } from "@/server/pagamentos/servico";

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
 * A regra de negócio inteira mora em `reconciliarPagamentosPendentes`. Aqui
 * fica só o portão: esta rota mexe em dinheiro e não pode ficar aberta na
 * internet.
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

export async function GET(request: Request) {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const segredo = process.env.CRON_SECRET?.trim();

    if (!segredo) {
      /*
       * Fora de produção não há cron nem dinheiro: a varredura roda solta,
       * para dar para exercitá-la localmente e na suíte.
       */
      if (process.env.VERCEL_ENV === "production") {
        log.erro(
          comoAppError(
            new Error(
              "CRON_SECRET ausente: a varredura de cobranças presas não roda. " +
                "Defina na Vercel, em Production, e republique.",
            ),
          ),
          { requestId, acao: "pagamentos.reconciliar" },
        );
        return NextResponse.json({ erro: "não configurado" }, { status: 503 });
      }
    } else if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
      /*
       * 401 sem detalhe: quem bateu aqui sem o segredo não precisa saber se
       * errou o cabeçalho ou se a rota existe para outra coisa.
       */
      log.warn("varredura pedida sem o segredo", {
        requestId,
        acao: "pagamentos.reconciliar",
      });
      return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
    }

    const resultado = await reconciliarPagamentosPendentes();

    log.info("varredura concluída", {
      requestId,
      acao: "pagamentos.reconciliar",
      vistas: resultado.vistas,
      reconciliadas: resultado.reconciliadas,
      ms: medir(),
    });

    return NextResponse.json(resultado, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "pagamentos.reconciliar", ms: medir() });
    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
