import { defineConfig, devices } from "@playwright/test";
import { ARQUIVO_SESSAO } from "./tests/e2e/helpers";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Cuiaba",
  },

  projects: [
    /*
     * Cria a conta uma vez e guarda a sessão. O app é fechado por login, e
     * cadastrar em cada teste custaria um Argon2id de 19 MiB por vez — o
     * servidor passaria mais tempo derivando hash do que respondendo.
     */
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: ARQUIVO_SESSAO },
      dependencies: ["setup"],
    },
    {
      // O público de Sinop chega pelo celular; é o caso principal.
      name: "mobile",
      use: { ...devices["Pixel 7"], storageState: ARQUIVO_SESSAO },
      dependencies: ["setup"],
    },
  ],

  // Sobe o app já compilado: o dev server mascara erros de produção.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        env: {
          /*
           * Modo demonstração à força.
           *
           * `npm start` carrega o `.env.local`, e quem tiver credenciais
           * reais ali passa a rodar a suíte contra o banco de produção sem
           * perceber. Aconteceu: o ajudante de login criou 213 contas na
           * base real antes de alguém notar que as asserções falhavam por
           * estarem medindo dados de verdade.
           *
           * Variável já presente no ambiente vence o arquivo, então vazio
           * aqui garante `isSupabaseConfigured === false`. A suíte precisa
           * medir sempre a mesma coisa, e isso não pode depender de qual
           * arquivo existe na máquina de quem roda.
           */
          NEXT_PUBLIC_SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
          SUPABASE_SERVICE_ROLE_KEY: "",
          /*
           * O app é fechado por login, então a suíte precisa criar conta e
           * entrar — e em produção a aplicação recusa subir sem segredo de
           * sessão, de propósito.
           *
           * Este valor é de teste e serve só ao servidor efêmero do
           * Playwright. Não vai para lugar nenhum: produção tem o seu, na
           * Vercel, e sem ele o deploy falha. Se um dia este literal for
           * copiado para um ambiente real, o problema é a cópia, não o
           * arquivo de teste.
           */
          SESSION_SECRET: "segredo-de-teste-do-playwright-com-mais-de-32-chars",
        },
      },
});
