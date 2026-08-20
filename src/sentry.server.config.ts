import * as Sentry from "@sentry/nextjs";
import {
  ENVIRONMENT,
  IGNORED_ERRORS,
  RELEASE,
  SENTRY_DSN,
  TRACES_SAMPLE_RATE,
  scrubSensitiveData,
} from "@/lib/observability";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  release: RELEASE,
  tracesSampleRate: TRACES_SAMPLE_RATE,
  ignoreErrors: IGNORED_ERRORS,
  // Não enviar IP nem cabeçalho de identificação por padrão.
  sendDefaultPii: false,
  beforeSend: (event) => scrubSensitiveData(event),
  beforeSendTransaction: (event) => scrubSensitiveData(event),
});
