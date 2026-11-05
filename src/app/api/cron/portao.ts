import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { comoAppError } from "@/server/errors";
import { log } from "@/server/logger";

/**
 * O portão das rotas de cron (#198, #358, #561).
 *
 * Saiu de dentro da varredura de pagamentos quando a segunda rota de cron
 * nasceu (#561): a regra de quem pode disparar uma varredura é uma só, e
 * duas cópias dela num caminho que mexe com dinheiro e com e-mail são o
 * lugar onde uma das duas acaba esquecida.
 *
 * **O portão é `CRON_SECRET`**, que a Vercel manda como `Authorization:
 * Bearer` quando a variável existe. Sem ela num deploy da Vercel, a rota
 * recusa e **grita no log** (a lição da #196: falha fechada está certa,
 * silenciosa não). Fora da Vercel — local e na suíte — roda solta, para dar
 * para exercitar.
 *
 * Devolve a resposta de recusa, ou `null` quando pode seguir.
 */
export function recusaDoCron(
  request: Request,
  contexto: { requestId: string; acao: string },
): NextResponse | null {
  const segredo = process.env.CRON_SECRET?.trim();

  if (!segredo) {
    if (!process.env.VERCEL) return null;
    log.erro(
      comoAppError(
        new Error(
          `CRON_SECRET ausente: a varredura ${contexto.acao} não roda. ` +
            "Defina na Vercel, em Production, e republique.",
        ),
      ),
      contexto,
    );
    return NextResponse.json({ erro: "não configurado" }, { status: 503 });
  }

  if (!segredoConfere(request.headers.get("authorization"), segredo)) {
    // Sem detalhe: quem bateu aqui sem o segredo não precisa saber por quê.
    log.warn("varredura pedida sem o segredo", contexto);
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  return null;
}

/** Compara sem vazar, pelo tempo, quantos caracteres já batem (#358). */
function segredoConfere(cabecalho: string | null, segredo: string): boolean {
  const recebido = Buffer.from(cabecalho ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return (
    recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
  );
}
