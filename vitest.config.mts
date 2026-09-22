import { cpus, totalmem } from "node:os";
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
    /*
     * Workers limitados pela memória, não pelos núcleos (#265).
     *
     * O padrão abre um worker por núcleo. Na máquina do Luiz são 16 núcleos
     * lógicos e 7,7 GB de RAM: ~15 workers, cada um com jsdom e o grafo do
     * servidor carregados, não cabem, e a máquina começa a paginar. Aí tudo
     * fica lento ao mesmo tempo — o `verify` reprovava por tempo em testes
     * triviais (um clique de botão estourando 5 s) e sempre no primeiro
     * teste dos arquivos que reimportam o serviço de pagamentos. O log
     * mostrava 705 s de setup acumulado numa suíte de 224 s.
     *
     * ~1,2 GB por worker, medido pelo que cabe: aqui dá 6. Numa máquina de
     * CI com mais memória que núcleos, quem limita são os núcleos, como
     * antes.
     */
    maxWorkers: Math.max(
      2,
      Math.min(cpus().length - 1, Math.floor(totalmem() / 1.2e9)),
    ),
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
        // Casca fina sobre next/headers; a lógica está em auth/session.ts,
        // que é testada, e o caminho completo é coberto pelo Playwright.
        "src/server/auth/cookies.ts",
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
