import { registerOTel } from "@vercel/otel";
import { conferirConfiguracaoDeProducao } from "@/server/config-obrigatoria";

/**
 * Instrumentação do servidor. O Next chama uma vez por processo.
 *
 * A conferência de configuração vem **primeiro**, antes de qualquer
 * outra coisa: é o único momento em que dá para distinguir "este deploy
 * subiu sem variável" de "alguém está forjando requisição", e é barato
 * derrubar aqui — ninguém foi atendido ainda. Deixar para descobrir no
 * meio de um pagamento foi o que custou a primeira venda da Lupa (#196).
 *
 * OpenTelemetry emite rastros em formato aberto; Sentry entra em cima
 * apenas se houver DSN configurado.
 */
export async function register() {
  conferirConfiguracaoDeProducao();

  registerOTel({ serviceName: "lupa" });

  const { isSentryEnabled } = await import("@/lib/observability");
  if (!isSentryEnabled) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Captura erros de Server Component, Server Action e Route Handler. */
export async function onRequestError(
  ...args: Parameters<
    NonNullable<Awaited<typeof import("@sentry/nextjs")>["captureRequestError"]>
  >
) {
  const { isSentryEnabled } = await import("@/lib/observability");
  if (!isSentryEnabled) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
