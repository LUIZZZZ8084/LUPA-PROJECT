import {
  Briefcase,
  Building2,
  FileText,
  LogIn,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Perfil",
};

const SHORTCUTS = [
  {
    href: "/vagas",
    icon: Briefcase,
    title: "Minhas candidaturas",
    description: "Acompanhe o status das vagas em que você se candidatou.",
    tone: "text-vagas",
  },
  {
    href: "/servicos",
    icon: Wrench,
    title: "Meu perfil de prestador",
    description: "Edite categoria, preço, bairros atendidos e fotos.",
    tone: "text-servicos",
  },
  {
    href: "/empresa",
    icon: Building2,
    title: "Minha Empresa",
    description: "Vagas publicadas, currículos recebidos e plano.",
    tone: "text-empresas",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    title: "Painel de verificações",
    description: "Aprovar documentos enviados (acesso do fundador).",
    tone: "text-warn",
  },
];

export default async function PerfilPage() {
  const user = await getCurrentUser();

  return (
    <PageShell width="narrow">
      <PageTitle title="Perfil" description="Sua conta e seus atalhos na Lupa." />

      {!user && (
        <Panel className="mb-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-panel-2 text-muted">
            <UserRound size={24} />
          </div>
          <h2 className="mt-4 font-bold">Você ainda não entrou</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Entre para se candidatar a vagas, gerenciar seu perfil de prestador
            ou publicar vagas pela sua empresa.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/entrar" variant="vagas" size="sm">
              <LogIn size={15} />
              Entrar
            </ButtonLink>
            <ButtonLink href="/cadastro" variant="outline" size="sm">
              Criar conta
            </ButtonLink>
          </div>
        </Panel>
      )}

      <div className="space-y-2.5">
        {SHORTCUTS.map(({ href, icon: Icon, title, description, tone }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2"
          >
            <Icon size={20} className={`mt-0.5 flex-none ${tone}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <Panel className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-muted" />
          Seus dados e a LGPD
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Documento de identidade e selfie são dados pessoais sensíveis. Na
          Lupa eles ficam em armazenamento privado, são usados só para
          confirmar sua identidade e são apagados assim que a verificação é
          concluída — permanece apenas o status aprovado no seu perfil.
        </p>
      </Panel>
    </PageShell>
  );
}
