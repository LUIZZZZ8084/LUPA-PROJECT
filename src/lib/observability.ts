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
 * Chaves que a máscara não percorre, porque nunca saem do processo.
 *
 * `sdkProcessingMetadata` é onde o SDK do Sentry guarda o próprio estado
 * durante o processamento — num evento de transação, a instância de
 * `Scope` em que o span nasceu, que aponta para si mesma. O SDK a apaga
 * antes de montar o envelope (`createEventEnvelope`, em `@sentry/core`),
 * então não há dado pessoal ali para mascarar. Percorrê-la custava toda a
 * medição de desempenho (#273).
 */
const INTERNAS_DO_SDK = new Set(["sdkProcessingMetadata"]);

/**
 * Identificadores de rastreio do SDK, que a máscara não pode tocar (#275).
 *
 * São hexadecimais aleatórios, e um hexadecimal aleatório tem com
 * frequência uma sequência de 10 ou 11 dígitos — que a regra de telefone
 * trocava por `[telefone]`, deixando `71624d67c92d40a1afa[telefone]b94`
 * no lugar do `trace_id`. O Sentry recusa a transação inteira quando o
 * identificador não tem o formato certo: depois da #273, 2 de cada 3
 * chegavam lá e voltavam como `invalid_transaction`.
 *
 * **As duas condições, e não uma.** A chave diz que o campo é um
 * identificador; o formato garante que o valor é mesmo só hexadecimal. Um
 * texto com telefone numa chave chamada `trace_id` continua mascarado — a
 * exceção vale para o que o SDK gera, não para o nome do campo.
 */
const CHAVES_DE_RASTREIO =
  /^(?:__span|(?:sentry\.)?(?:trace_id|span_id|parent_span_id|segment_id|event_id|replay_id|profile_id|previous_trace))$/;
const FORMATO_DE_RASTREIO = /^[0-9a-f]{16,32}(?:-[0-9a-f]{16}(?:-[01])?)?$/i;

/**
 * Remove dado pessoal antes do envio.
 *
 * O Lupa lida com telefone, CPF/CNPJ e documento. Nada disso pode sair para
 * um serviço de terceiro — é exigência da LGPD, não preferência.
 *
 * **Ciclo não derruba a máscara (#273).** Ela percorria o evento sem
 * lembrar por onde já tinha passado, e o evento de transação carrega um
 * objeto do SDK com referência circular: a função dava voltas até estourar
 * a pilha. Uma exceção no `beforeSendTransaction` faz o SDK descartar a
 * transação e mandar no lugar um erro interno, que **não passa pelo
 * `beforeSend`** — então a quebra não só perdia a medição como produzia o
 * único evento que sai sem máscara. Hoje o que já está sendo visitado vira
 * `"[circular]"`: um objeto que contém a si mesmo não tem como ser
 * serializado de qualquer forma.
 */
export function scrubSensitiveData<T>(event: T): T {
  const CAMPOS_SENSIVEIS =
    /(phone|telefone|whatsapp|cpf|cnpj|documento|document|selfie|password|senha|token|secret|resume|curriculo)/i;

  /*
   * Só o caminho atual, não tudo que já foi visto: o mesmo objeto
   * aparecendo em dois galhos do evento é repetição, não ciclo, e tem de
   * ser mascarado nos dois.
   */
  const noCaminho = new WeakSet<object>();

  const limpar = (valor: unknown, chave?: string): unknown => {
    if (chave && CAMPOS_SENSIVEIS.test(chave)) return "[removido]";

    if (
      chave &&
      typeof valor === "string" &&
      CHAVES_DE_RASTREIO.test(chave) &&
      FORMATO_DE_RASTREIO.test(valor)
    ) {
      return valor;
    }

    if (typeof valor === "string") {
      /*
       * A ordem importa. CNPJ tem 14 dígitos e contém um CPF válido nos 11
       * primeiros; CPF tem 11 e é indistinguível de um celular sem máscara.
       * Por isso vai do padrão mais específico para o mais genérico.
       *
       * Em sequências ambíguas o rótulo pode sair trocado — um celular sem
       * máscara vira "[cpf]". Isso é aceitável: o que não pode acontecer é
       * o número sair inteiro. Mascarar a mais é seguro; a menos, não.
       *
       * Sem \b nas bordas: ele não ancora antes de "(", e o parêntese de um
       * "(66) 99911-0001" escapava da máscara.
       */
      return (
        valor
          // CNPJ, com ou sem máscara.
          .replace(
            /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g,
            "[cnpj]",
          )
          // Telefone declaradamente telefone: com DDI, parênteses ou o 9.
          .replace(
            /(?<!\d)(?:\+?55[\s.-]?)?\(\d{2}\)[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g,
            "[telefone]",
          )
          .replace(
            /(?<!\d)\+?55[\s.-]?\d{2}[\s.-]?9?\d{4}[\s.-]?\d{4}(?!\d)/g,
            "[telefone]",
          )
          // CPF com máscara.
          .replace(/(?<!\d)\d{3}\.\d{3}\.\d{3}-?\d{2}(?!\d)/g, "[cpf]")
          /*
           * Sequência solta de 10 ou 11 dígitos — neste app, quase sempre um
           * telefone ou um CPF. Os limites (?<!\d) e (?!\d) impedem que um
           * timestamp de 13 dígitos seja picotado no meio.
           */
          .replace(
            /(?<!\d)\d{2}[\s.-]?\d{4,5}[\s.-]?\d{4}(?!\d)/g,
            "[telefone]",
          )
      );
    }

    if (!valor || typeof valor !== "object") return valor;
    if (noCaminho.has(valor)) return "[circular]";

    noCaminho.add(valor);
    try {
      if (Array.isArray(valor)) return valor.map((v) => limpar(v));

      return Object.fromEntries(
        Object.entries(valor as Record<string, unknown>).map(([k, v]) => [
          k,
          INTERNAS_DO_SDK.has(k) ? v : limpar(v, k),
        ]),
      );
    } finally {
      noCaminho.delete(valor);
    }
  };

  return limpar(event) as T;
}
