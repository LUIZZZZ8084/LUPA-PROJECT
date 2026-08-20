import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve o alias `@/*` direto do tsconfig, sem plugin extra.
    tsconfigPaths: true,
    alias: {
      // `server-only` lança erro fora de um Server Component. Nos testes
      // exercitamos as funções diretamente, então neutralizamos o guard.
      // A proteção continua valendo em produção.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // O pool de forks trava no Windows; threads é estável nos dois sistemas.
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      /*
       * A métrica cobre o que teste unitário deve cobrir: domínio, dados,
       * formatação e componentes de apresentação.
       *
       * Rotas, formulários e server actions ficam de fora de propósito —
       * quem os exercita é o Playwright, num navegador de verdade. Incluí-
       * los aqui produziria um número baixo que não diz nada sobre risco e
       * empurraria para escrever teste de fachada só para subir a barra.
       */
      include: [
        "src/lib/**/*.ts",
        "src/server/**/*.ts",
        "src/components/**/*.tsx",
      ],
      exclude: [
        "src/**/*.d.ts",
        // Dados de demonstração: conteúdo, não lógica.
        "src/lib/mock-data.ts",
        // Só marcação; o que importa deles é a forma, verificada no e2e.
        "src/components/ui/skeleton.tsx",
        // Client components de navegação e movimento, cobertos pelo e2e.
        "src/components/filter-bar.tsx",
        "src/components/motion/**",
        "src/components/layout/**",
        "src/components/apply-button.tsx",
        // Clientes do Supabase: dependem do runtime do Next.
        "src/lib/supabase/client.ts",
        "src/lib/supabase/server.ts",
      ],
      thresholds: {
        // Piso um pouco abaixo do atingido hoje, para travar o patamar sem
        // quebrar o build por variação de uma linha. Sobe junto com a suíte.
        lines: 90,
        functions: 85,
        branches: 80,
        statements: 88,
      },
    },
  },
});
