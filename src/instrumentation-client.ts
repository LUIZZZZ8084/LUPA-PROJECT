import * as Sentry from "@sentry/nextjs";
import {
  ENVIRONMENT,
  IGNORED_ERRORS,
  isSentryEnabled,
  RELEASE,
  SENTRY_DSN,
  scrubSensitiveData,
  TRACES_SAMPLE_RATE,
} from "@/lib/observability";

/**
 * Instrumentação do navegador. Sem DSN nada é carregado — o usuário em
 * Sinop, muitas vezes em 3G e aparelho antigo, não paga por um SDK que não
 * está em uso.
 */
if (isSentryEnabled) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    ignoreErrors: IGNORED_ERRORS,
    sendDefaultPii: false,

    integrations: [
      Sentry.replayIntegration({
        // A gravação de sessão nunca mostra o que a pessoa digitou:
        // o cadastro tem telefone, CPF e documento.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    // Grava 0% das sessões normais e 100% das que deram erro — é onde está
    // a informação útil, e mantém o custo baixo.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,

    beforeSend: (event) => scrubSensitiveData(event),
    beforeSendTransaction: (event) => scrubSensitiveData(event),
  });
}

export const onRouterTransitionStart = isSentryEnabled
  ? Sentry.captureRouterTransitionStart
  : undefined;
