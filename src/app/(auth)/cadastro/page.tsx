import { ArrowRight, Briefcase, Building2, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageTitle } from "@/components/layout/page-shell";
import type { Role } from "@/lib/types";
import { SignUpForm } from "./form";

/*
 * O título diz que conta está sendo criada (#303). As três telas de
 * cadastro eram "Criar conta" na aba, e quem abre o link de cadastro de
 * empresa recebido por WhatsApp precisa ver que está no lugar certo antes
 * de ler a tela.
 */
const TITULO_POR_PAPEL: Record<Role, string> = {
  candidato_clt: "Criar conta para procurar emprego",
  prestador_servico: "Criar conta de prestador de serviço",
  empresa: "Criar conta de empresa",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}): Promise<Metadata> {
  const { tipo } = await searchParams;
  const selecionado = Array.isArray(tipo) ? tipo[0] : tipo;

  return {
    title: isRole(selecionado) ? TITULO_POR_PAPEL[selecionado] : "Criar conta",
    description: "Crie sua conta na Lupa como candidato, prestador ou empresa.",
  };
}

const ROLES = [
  {
    role: "candidato_clt" as const,
    icon: Briefcase,
    tone: "vagas" as const,
    title: "Quero um emprego",
    description:
      "Busque vagas por cidade e categoria, e candidate-se em um toque.",
  },
  {
    role: "prestador_servico" as const,
    icon: Wrench,
    tone: "servicos" as const,
    title: "Ofereço um serviço",
    description:
      "Crie seu perfil de autônomo e seja encontrado por quem precisa perto de você.",
  },
  {
    role: "empresa" as const,
    icon: Building2,
    tone: "empresas" as const,
    title: "Minha empresa contrata",
    description:
      "Publique vagas, receba currículos organizados e acompanhe as visualizações.",
  },
];

const TONE_STYLES = {
  vagas: {
    hover: "hover:border-vagas/50",
    icon: "bg-vagas/12 text-vagas",
    title: "text-vagas",
  },
  servicos: {
    hover: "hover:border-servicos/50",
    icon: "bg-servicos/12 text-servicos",
    title: "text-servicos",
  },
  empresas: {
    hover: "hover:border-empresas/50",
    icon: "bg-empresas/12 text-empresas",
    title: "text-empresas",
  },
};

function isRole(value: string | undefined): value is Role {
  return (
    value === "candidato_clt" ||
    value === "prestador_servico" ||
    value === "empresa"
  );
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  const { tipo } = await searchParams;
  const selected = Array.isArray(tipo) ? tipo[0] : tipo;

  if (isRole(selected)) {
    /*
     * O título e o "voltar" moram dentro do formulário: depois de criada a
     * conta, "Leva menos de dois minutos" e "Escolher outro tipo de conta"
     * deixam de ser verdade — e ocupavam o topo da tela que precisa caber
     * inteira no celular (#299).
     */
    return (
      <PageShell width="narrow">
        <SignUpForm role={selected} />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageTitle
        title="Criar conta na Lupa"
        description="Como você vai usar a plataforma? Dá para mudar depois."
      />

      <div className="space-y-3">
        {ROLES.map(({ role, icon: Icon, tone, title, description }) => {
          const styles = TONE_STYLES[tone];
          return (
            <Link
              key={role}
              href={`/cadastro?tipo=${role}`}
              className={`group flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-panel p-5 transition-colors hover:bg-panel-2 ${styles.hover}`}
            >
              <span
                className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${styles.icon}`}
              >
                <Icon size={21} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${styles.title}`}>
                  {title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {description}
                </span>
              </span>
              <ArrowRight
                size={18}
                className="mt-1 flex-none text-faint transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-vagas hover:underline">
          Entrar
        </Link>
      </p>
    </PageShell>
  );
}
