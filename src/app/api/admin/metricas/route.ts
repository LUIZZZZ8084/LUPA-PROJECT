import { NextResponse } from "next/server";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { comoAppError } from "@/server/errors";
import { cronometro, log, novoRequestId } from "@/server/logger";
import { painelAdmin } from "@/server/metrics/servico";

/**
 * Métricas do painel administrativo, para o polling da tela.
 *
 * Rota em vez de server action porque o cliente refaz a chamada num
 * intervalo: `fetch` para uma rota é mais simples de cancelar, tem cache
 * controlável por cabeçalho e não invalida o roteador do Next a cada volta.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = novoRequestId();
  const medir = cronometro();

  try {
    const sessao = await sessaoAtual();

    /*
     * Quem não é admin recebe 404, não 403.
     *
     * Um 403 confirma que a rota existe e que há algo por trás dela. Para
     * uma área administrativa, é melhor que ela simplesmente não exista aos
     * olhos de quem não deveria alcançá-la.
     */
    if (!sessao || !pode(sessao.papel, "admin:metricas")) {
      log.warn("acesso negado ao painel", {
        requestId,
        acao: "admin.metricas",
        papel: sessao?.papel ?? "anonimo",
      });
      return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
    }

    const url = new URL(request.url);
    const diasBruto = Number(url.searchParams.get("dias") ?? 30);
    // Teto para que ninguém peça dez mil dias e derrube a consulta.
    const dias = Number.isFinite(diasBruto)
      ? Math.min(Math.max(Math.trunc(diasBruto), 1), 180)
      : 30;

    const painel = await painelAdmin(sessao, dias);

    log.info("painel apurado", {
      requestId,
      acao: "admin.metricas",
      papel: sessao.papel,
      ms: medir(),
      dias,
    });

    return NextResponse.json(painel, {
      // Métrica em tempo real não pode vir de cache de borda.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const erro = comoAppError(e);
    log.erro(erro, { requestId, acao: "admin.metricas", ms: medir() });

    return NextResponse.json(erro.paraCliente(), { status: erro.status });
  }
}
