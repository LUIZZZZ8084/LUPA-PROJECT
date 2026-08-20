/**
 * Configuração compartilhada de observabilidade.
 *
 * Sentry cuida de erro e desempenho; OpenTelemetry emite rastros em formato
 * neutro, para que trocar de fornecedor (Datadog, New Relic, Grafana) não
 * exija reescrever instrumentação.
 *
 * Tudo é opcional: sem DSN configurado, nada é enviado e o app funciona
 * igual. Isso mantém o modo demonstração leve e o desenvolvimento offline.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
export const isSentryEnabled = Boolean(SENTRY_DSN);

export const ENVIRONMENT =
  process.env.NEXT_PUBLIC_APP_ENV ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV ??
  "development";

/** Commit que gerou o build — liga um erro à linha de código exata. */
export const RELEASE =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA;

/**
 * Amostragem de rastros. Em produção 10% já dá sinal estatístico sem
 * estourar a cota gratuita; em desenvolvimento, tudo.
 */
export const TRACES_SAMPLE_RATE = ENVIRONMENT === "production" ? 0.1 : 1;

/** Erros que não valem alerta — ruído de extensão de navegador e rede. */
export const IGNORED_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "AbortError",
  // Extensões injetam script na página e quebram sozinhas.
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
];

/**
 * Remove dado pessoal antes do envio.
 *
 * O Lupa lida com telefone, CPF/CNPJ e documento. Nada disso pode sair para
 * um serviço de terceiro — é exigência da LGPD, não preferência.
 */
export function scrubSensitiveData<T>(event: T): T {
  const CAMPOS_SENSIVEIS =
    /(phone|telefone|whatsapp|cpf|cnpj|documento|document|selfie|password|senha|token|secret|resume|curriculo)/i;

  const limpar = (valor: unknown, chave?: string): unknown => {
    if (chave && CAMPOS_SENSIVEIS.test(chave)) return "[removido]";

    if (typeof valor === "string") {
      return valor
        // Telefone brasileiro com ou sem máscara.
        .replace(/\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, "[telefone]")
        // CPF e CNPJ.
        .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[cpf]")
        .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[cnpj]");
    }

    if (Array.isArray(valor)) return valor.map((v) => limpar(v));

    if (valor && typeof valor === "object") {
      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
          k,
          limpar(v, k),
        ]),
      );
    }

    return valor;
  };

  return limpar(event) as T;
}
