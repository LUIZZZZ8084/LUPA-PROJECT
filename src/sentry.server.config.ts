import * as Sentry from "@sentry/nextjs";
import {
  CICLO_DOS_RASTROS,
  COLETA_DE_DADOS,
  ENVIRONMENT,
  IGNORED_ERRORS,
  RELEASE,
  SENTRY_DSN,
  scrubSensitiveData,
  TRACES_SAMPLE_RATE,
} from "@/lib/observability";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: RELEASE,
  tracesSampleRate: TRACES_SAMPLE_RATE,
  ignoreErrors: IGNORED_ERRORS,
  // Coleta restrita e rastros por transação: ver `observability.ts` (#596).
  dataCollection: COLETA_DE_DADOS,
  traceLifecycle: CICLO_DOS_RASTROS,
  beforeSend: (event) => scrubSensitiveData(event),
  beforeSendTransaction: (event) => scrubSensitiveData(event),
});
