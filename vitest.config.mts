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
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        // Camadas sem lógica própria: layout, ícones gerados e configuração.
        "src/app/**/layout.tsx",
        "src/app/icon.tsx",
        "src/app/apple-icon.tsx",
        "src/app/manifest.ts",
        "src/lib/mock-data.ts",
        "src/proxy.ts",
        "src/instrumentation*.ts",
      ],
      thresholds: {
        // Piso deliberadamente alcançável: sobe conforme a suíte cresce.
        lines: 60,
        functions: 60,
        branches: 70,
        statements: 60,
      },
    },
  },
});
