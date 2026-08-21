import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { DemoBanner } from "@/components/demo-banner";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { RouteProgress } from "@/components/motion/route-progress";
import { sessaoAtual } from "@/server/auth/cookies";
import { usuarioDaSessao } from "@/server/auth/servico";
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
    statusBarStyle: "black-translucent",
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
  themeColor: "#0b0f14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * O layout lê a sessão e desce por prop.
 *
 * O cabeçalho é componente de cliente: precisa do `usePathname` para marcar
 * a seção ativa. Ler cookie lá dentro não é possível, e um `useSearchParams`
 * ou um provider de sessão traria de volta o problema de boundary que já
 * deixou a barra de filtros invisível neste projeto.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  const usuario = sessao ? await usuarioDaSessao(sessao.usuarioId) : null;

  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <RouteProgress />
        <DemoBanner />
        <AppHeader
          usuario={
            usuario && {
              nome: usuario.nomeCompleto,
              papel: usuario.papel,
              avatarUrl: usuario.avatarUrl ?? null,
            }
          }
        />
        <div className="flex-1">{children}</div>
        <BottomNav autenticado={Boolean(usuario)} />
      </body>
    </html>
  );
}
