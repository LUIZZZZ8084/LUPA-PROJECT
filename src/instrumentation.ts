import { registerOTel } from "@vercel/otel";

/**
 * Instrumentação do servidor. O Next chama uma vez por processo.
 *
 * OpenTelemetry emite rastros em formato aberto; Sentry entra em cima
 * apenas se houver DSN configurado.
 */
export async function register() {
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
    NonNullable<
      Awaited<typeof import("@sentry/nextjs")>["captureRequestError"]
    >
  >
) {
  const { isSentryEnabled } = await import("@/lib/observability");
  if (!isSentryEnabled) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
