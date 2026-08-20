/**
 * Teste de mutação.
 *
 * O Stryker altera o código de propósito — troca `>` por `>=`, inverte um
 * `if`, esvazia um retorno — e verifica se algum teste quebra. Mutante que
 * sobrevive é linha coberta por um teste que não afirma nada de útil. É a
 * diferença entre "a linha executou" e "o comportamento está garantido".
 *
 * O escopo é a lógica pura de domínio. Rodar sobre componentes e rotas
 * multiplicaria o tempo por dez para medir o que o Playwright já cobre —
 * e uma verificação que ninguém espera terminar não é executada.
 *
 *   npm run test:mutation
 */
const configuracao = {
  packageManager: "npm",
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.mts" },
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutacao.html" },

  mutate: [
    "src/lib/format.ts",
    "src/lib/data.ts",
    "src/lib/demo.ts",
    "src/lib/observability.ts",
  ],

  coverageAnalysis: "perTest",
  // Uma mutação em loop pode não terminar nunca.
  timeoutMS: 20_000,
  concurrency: 4,

  thresholds: {
    // Abaixo de 60 o build falha; entre 60 e 75 passa com aviso.
    high: 85,
    low: 75,
    break: 60,
  },

  // A camada de dados tem muitos ramos de fallback equivalentes entre si;
  // desativar mutação de string evita ruído sem perder sinal real.
  disableTypeChecks: true,
  ignorers: [],
  tempDirName: ".stryker-tmp",
};

export default configuracao;
