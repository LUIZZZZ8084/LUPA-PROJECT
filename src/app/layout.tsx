import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
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
    "Vagas de emprego, prestadores de serviço verificados e empresas " +
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
      "Vagas, serviços e empresas em Sinop-MT. Perfis verificados, contato direto no WhatsApp.",
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
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
