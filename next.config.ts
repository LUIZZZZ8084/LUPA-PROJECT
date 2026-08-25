import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * É a última linha: se alguma entrada escapar do escape em qualquer lugar,
 * é ela que impede o script injetado de rodar ou de mandar o que roubou
 * para fora.
 *
 * `'unsafe-inline'` em `script-src` existe porque o Next injeta o script de
 * hidratação inline, sem nonce, no App Router. Tirá-lo hoje quebra o app;
 * a saída é migrar para nonce quando o Next facilitar, e até lá a política
 * vale pelo resto — nenhum script de terceiro carrega, e `connect-src`
 * limita para onde os dados podem ir.
 *
 * `img-src` aceita `https:` porque avatar e logo vêm do Storage do
 * Supabase, cujo domínio muda por projeto; `data:` é para o SVG inline dos
 * ícones. `frame-ancestors 'none'` repete o X-Frame-Options para
 * navegador que já ignora o cabeçalho antigo.
 */
/*
 * O React em modo de desenvolvimento usa `eval` para reconstruir a pilha de
 * chamada de erro vinda do servidor. Sem `'unsafe-eval'`, todo `npm run
 * dev` abre com um erro vermelho no console que não tem nada a ver com o
 * código — ruído que treina a equipe a ignorar o console.
 *
 * Vale só no `dev`. O bundle de produção não usa `eval`, e é ele que vai
 * para a Vercel.
 */
const EVAL_NO_DEV =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${EVAL_NO_DEV}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Falhar o build em erro de tipo é proposital: é mais barato corrigir
  // aqui do que descobrir com um usuário em Sinop. O lint roda separado,
  // via `npm run lint` e no pre-commit.
  typescript: { ignoreBuildErrors: false },

  experimental: {
    // Importa só o ícone usado do lucide, em vez do pacote inteiro.
    optimizePackageImports: ["lucide-react"],
  },

  /*
   * @node-rs/argon2 é um binding nativo: precisa ser carregado pelo Node em
   * tempo de execução, não empacotado. Sem isto o build resolve o `.node`
   * como se fosse JavaScript e quebra no deploy.
   */
  serverExternalPackages: ["@node-rs/argon2"],

  /*
   * `X-Powered-By: Next.js` entrega o framework e a versão de superfície a
   * quem estiver procurando alvo, sem nenhum ganho para quem usa o site.
   */
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

const sentryEnabled = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

/**
 * O wrapper do Sentry só entra quando há organização e projeto
 * configurados. Sem isso o build seguiria tentando subir source maps e
 * falharia — e o modo demonstração precisa buildar em qualquer máquina.
 */
export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      // Source maps sobem para o Sentry e são removidos do bundle público:
      // stack trace legível para nós, código não exposto para o usuário.
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      // Encaminha os eventos do navegador por uma rota do próprio domínio,
      // driblando bloqueadores de anúncio que engolem chamadas ao Sentry.
      tunnelRoute: "/monitoring",
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig;
