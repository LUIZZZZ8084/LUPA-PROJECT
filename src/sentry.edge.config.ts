import * as Sentry from "@sentry/nextjs";
import {
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
  sendDefaultPii: false,
  beforeSend: (event) => scrubSensitiveData(event),
});
