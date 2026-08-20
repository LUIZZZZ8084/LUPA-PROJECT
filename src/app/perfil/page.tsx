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
import { SairButton } from "@/components/sair-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { VerificationRow } from "@/components/verified-badge";
import { ROLE_LABELS } from "@/lib/constants";
import { formatPhone } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import type { Capacidade } from "@/server/auth/rbac";
import { pode } from "@/server/auth/rbac";
import { usuarioDaSessao } from "@/server/auth/servico";

export const metadata: Metadata = {
  title: "Perfil",
};

/**
 * Os atalhos aparecem conforme a capacidade do papel.
 *
 * Mostrar um link que devolve "sem permissão" ao ser clicado é pior do que
 * não mostrar: a pessoa conclui que o app está quebrado.
 */
const ATALHOS: {
  href: string;
  icon: typeof Briefcase;
  titulo: string;
  descricao: string;
  cor: string;
  exige: Capacidade;
}[] = [
  {
    href: "/vagas",
    icon: Briefcase,
    titulo: "Minhas candidaturas",
    descricao: "Acompanhe o status das vagas em que você se candidatou.",
    cor: "text-vagas",
    exige: "candidatura:ver_propria",
  },
  {
    href: "/servicos",
    icon: Wrench,
    titulo: "Meu perfil de prestador",
    descricao: "Edite categoria, preço, bairros atendidos e publicações.",
    cor: "text-servicos",
    exige: "publicacao:criar",
  },
  {
    href: "/empresa",
    icon: Building2,
    titulo: "Minha Empresa",
    descricao: "Vagas publicadas, currículos recebidos e plano.",
    cor: "text-empresas",
    exige: "vaga:publicar",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    titulo: "Painel de verificações",
    descricao: "Aprovar documentos enviados.",
    cor: "text-warn",
    exige: "admin:decidir_verificacao",
  },
];

export default async function PerfilPage() {
  const sessao = await sessaoAtual();
  const usuario = sessao ? await usuarioDaSessao(sessao.usuarioId) : null;

  const atalhos = sessao
    ? ATALHOS.filter((a) => pode(sessao.papel, a.exige))
    : [];

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Perfil"
        description="Sua conta e seus atalhos na Lupa."
      />

      {usuario ? (
        <Panel className="mb-5">
          <div className="flex items-start gap-4">
            <Avatar
              name={usuario.nomeCompleto}
              src={usuario.avatarUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold">
                {usuario.nomeCompleto}
              </h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {usuario.email}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {formatPhone(usuario.telefone)}
                {usuario.bairro ? ` · ${usuario.bairro}` : ""} ·{" "}
                {usuario.cidade}
              </p>
              <div className="mt-2.5">
                <Badge tone="neutral">
                  {sessao && sessao.papel === "admin"
                    ? "Administrador"
                    : ROLE_LABELS[usuario.papel as keyof typeof ROLE_LABELS]}
                </Badge>
              </div>
            </div>
          </div>

          <VerificationRow
            className="mt-5"
            phoneVerified={usuario.telefoneVerificado}
            docVerified={usuario.docVerificado}
          />

          <div className="mt-5 border-t border-line pt-4">
            <SairButton />
          </div>
        </Panel>
      ) : (
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

      {atalhos.length > 0 && (
        <div className="space-y-2.5">
          {atalhos.map(({ href, icon: Icon, titulo, descricao, cor }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2"
            >
              <Icon size={20} className={`mt-0.5 flex-none ${cor}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{titulo}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  {descricao}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <Panel className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText size={16} className="text-muted" />
          Seus dados e a LGPD
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Documento de identidade e selfie são dados pessoais sensíveis. Na Lupa
          eles ficam em armazenamento privado, são usados só para confirmar sua
          identidade e são apagados assim que a verificação é concluída —
          permanece apenas o status aprovado no seu perfil.
        </p>
      </Panel>
    </PageShell>
  );
}
