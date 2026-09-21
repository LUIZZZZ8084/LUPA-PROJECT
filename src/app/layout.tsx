import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import { DemoBanner } from "@/components/demo-banner";
import { RouteProgress } from "@/components/motion/route-progress";
import { SCRIPT_TEMA_INICIAL } from "@/lib/theme";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lupa — Trabalho e profissionais perto de você",
    template: "%s · Lupa",
  },
  description:
    "Vagas de emprego, prestadores de serviço e empresas " +
    "contratando em Sinop-MT. Filtrado por bairro e categoria, sem se perder " +
    "em grupo de WhatsApp.",
  applicationName: "Lupa",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lupa",
    /*
     * "black-translucent" sobrepõe o conteúdo à barra de status com
     * ícone claro — pensado para app de fundo escuro. Com claro como
     * padrão, esse ícone claro sumiria contra o cabeçalho claro do
     * topo. "default" dá barra clara com ícone escuro, o par certo para
     * quem abre a instalada sem ter trocado de tema.
     */
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Lupa — Trabalho e profissionais perto de você",
    description:
      "Vagas, serviços e empresas em Sinop-MT e no resto de Mato Grosso. Contato direto pelo WhatsApp.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f8fa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Só o esqueleto do documento.
 *
 * Cabeçalho e barra inferior vivem em `(app)/layout.tsx`. As telas de
 * autenticação, em `(auth)`, não têm nenhum dos dois: uma página de login
 * com menu do app e um botão "Entrar" ao lado do formulário de entrar é
 * redundante, e o botão sugere que o login está em outro lugar.
 *
 * A separação é por pasta, e não por `if` dentro do cabeçalho, para que
 * "tela de autenticação não tem menu" seja fato do arranjo — quem criar a
 * próxima tela de auth herda o comportamento sem precisar saber disso.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * O nonce da requisição, posto pelo `proxy.ts` (#223).
   *
   * O Next assina sozinho os scripts de hidratação que ele injeta. O script
   * de tema abaixo é **nosso**, e por isso precisa ser assinado à mão — sem
   * isto o navegador o recusa, e o recuso é silencioso para quem usa: a
   * página carrega, só que piscando branco antes do tema escuro.
   *
   * Foi o e2e que pegou, e não a leitura do cabeçalho: a CSP ficava
   * perfeita na resposta e o script morria na tela. É a lição que o
   * AGENTS.md registra três vezes — confirme num navegador de verdade.
   */
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} h-full antialiased`}
      // O script abaixo muda `data-theme` antes da hidratação, para
      // quem já escolheu escuro — sem isso, o React acusaria o `<html>`
      // do servidor (sem o atributo) como diferente do cliente.
      suppressHydrationWarning
    >
      <head>
        {/* Roda antes da primeira pintura — ver o comentário em `lib/theme.ts`. */}
        <script
          nonce={nonce}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script fixo do próprio código, não dado de entrada.
          dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <RouteProgress />
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
