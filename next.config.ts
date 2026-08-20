import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

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
