import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { hostsDeImagemRemota } from "./src/lib/imagens";

/*
 * A Content-Security-Policy **não mora mais aqui** (#223).
 *
 * Ela passou a ser montada por requisição em `src/lib/csp.ts` e aplicada
 * pelo `src/proxy.ts`, porque ganhou um nonce — e constante não tem nonce.
 * Com `'unsafe-inline'` sozinho, a política não impedia a coisa que existe
 * para impedir: script injetado rodava.
 *
 * Os outros cabeçalhos continuam aqui: são fixos, e fixo é mais barato de
 * servir pela configuração do que por middleware.
 */

const nextConfig: NextConfig = {
  images: {
    remotePatterns: hostsDeImagemRemota(),
    /*
     * Só os tamanhos que a grade e o ampliado realmente pedem. Cada
     * largura na lista é uma variante que a Vercel gera e cobra; deixar o
     * padrão do Next (oito larguras) multiplicaria isso sem ninguém ver
     * diferença numa miniatura de terço de tela.
     */
    imageSizes: [96, 128, 200, 256],
    deviceSizes: [360, 480, 640, 828, 1080],
  },

  // Falhar o build em erro de tipo é proposital: é mais barato corrigir
  // aqui do que descobrir com um usuário em Sinop. O lint roda separado,
  // via `npm run lint` e no pre-commit.
  typescript: { ignoreBuildErrors: false },

  experimental: {
    // Importa só o ícone usado do lucide, em vez do pacote inteiro.
    optimizePackageImports: ["lucide-react"],

    /*
     * Sem isto, o Next recusa o corpo de qualquer Server Action acima de
     * 1 MB — o padrão do framework — antes mesmo de chegar em
     * `conferirArquivo` (`src/server/arquivos/regras.ts`), que promete até
     * 2 MB de imagem e 5 MB de currículo. A rejeição do framework não passa
     * pelo `try/catch` de `criarAcao`: a tela quebra em vez de mostrar
     * mensagem amigável. O valor cobre a maior regra com folga para o
     * envelope do multipart.
     */
    serverActions: { bodySizeLimit: "6mb" },
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
