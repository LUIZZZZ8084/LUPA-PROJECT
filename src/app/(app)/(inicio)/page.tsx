import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { PageShell } from "@/components/layout/page-shell";
import { Reveal } from "@/components/motion/reveal";
import { ProviderCard } from "@/components/provider-card";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { CIDADE_INICIAL, ESTADO_NOME } from "@/lib/constants";
import { getHomeFeed } from "@/lib/data";
import { origemDoUsuario } from "@/server/auth/origem";

export default async function HomePage() {
  // Os destaques também vêm do mais perto para o mais longe: a home é a
  // primeira impressão, e quatro vagas de Cuiabá para quem é de Sinop
  // dizem que o app não é da cidade dela.
  const { jobs, providers, totals } = await getHomeFeed(
    await origemDoUsuario(),
  );

  return (
    <>
      <section className="aurora border-b border-line">
        <div className="mx-auto max-w-4xl px-4 pt-10 pb-12 sm:px-6 sm:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/60 px-3 py-1 text-[11px] font-medium text-muted">
            <MapPin size={12} className="text-vagas" />
            {ESTADO_NOME} · começando por {CIDADE_INICIAL}
          </span>

          <h1 className="mt-5 text-[2rem] leading-[1.1] font-bold tracking-tight sm:text-5xl">
            Trabalho e oportunidades
            <br />
            <span className="text-vagas">perto de você.</span>
          </h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
            Vagas de emprego, prestação de serviços e profissionais qualificados
            na sua região — com perfil verificado e contato direto no WhatsApp.
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ActionCard
              href="/vagas"
              icon={<Briefcase size={20} />}
              title="Procurar emprego"
              subtitle={`${totals.jobs} vagas abertas`}
              tone="vagas"
            />
            <ActionCard
              href="/servicos"
              icon={<Wrench size={20} />}
              title="Procurar profissional"
              subtitle={`${totals.providers} perto de você`}
              tone="servicos"
            />
            <ActionCard
              href="/cadastro?tipo=prestador_servico"
              icon={<Users size={20} />}
              title="Oferecer serviço"
              subtitle="Divulgue suas habilidades"
              tone="empresas"
            />
          </div>
        </div>
      </section>

      <PageShell>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <FeedSection
            title="Vagas em destaque"
            href="/vagas"
            accent="text-vagas"
          >
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </FeedSection>

          <FeedSection
            title="Profissionais bem avaliados"
            href="/servicos"
            accent="text-servicos"
          >
            {providers.map((provider) => (
              <ProviderCard key={provider.profile_id} provider={provider} />
            ))}
          </FeedSection>
        </div>

        {/* Confiança — o que faz alguém contratar um desconhecido */}
        <Reveal>
          <Panel className="mt-10">
            <h2 className="text-lg font-bold">
              Confiança que <span className="text-vagas">faz a diferença</span>
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-muted">
              Perfis verificados, avaliações reais e recomendações — para você
              escolher com segurança quem entra na sua casa ou na sua empresa.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
              <TrustItem
                icon={<MessageCircle size={22} />}
                title="Telefone verificado"
                description="Mais segurança nas conversas"
              />
              <TrustItem
                icon={<BadgeCheck size={22} />}
                title="Documento verificado"
                description="Identidade confirmada"
              />
              <TrustItem
                icon={<Star size={22} />}
                title="Avaliações reais"
                description="A experiência de quem já contratou"
              />
              <TrustItem
                icon={<ShieldCheck size={22} />}
                title="Profissionais locais"
                description="Gente da sua cidade e da região"
              />
            </div>
          </Panel>
        </Reveal>

        {/* Chamada para empresas */}
        <Reveal delay={60}>
          <Panel className="mt-5 border-empresas/25 bg-gradient-to-br from-empresas/8 to-transparent">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-empresas/15 text-empresas">
                  <Building2 size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-empresas">
                    Sua empresa está contratando?
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted">
                    Publique vagas, receba currículos organizados e acompanhe
                    visualizações. A primeira vaga é gratuita.
                  </p>
                </div>
              </div>
              <ButtonLink href="/empresa" variant="empresas">
                Painel da empresa
                <ArrowRight size={16} />
              </ButtonLink>
            </div>
          </Panel>
        </Reveal>

        <p className="mt-8 text-center text-xs text-faint">
          Lupa · aberto a todo o {ESTADO_NOME} · começamos por {CIDADE_INICIAL}
        </p>
      </PageShell>
    </>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: "vagas" | "servicos" | "empresas";
}) {
  const { border, icon: iconStyle } = {
    vagas: { border: "hover:border-vagas/50", icon: "bg-vagas/12 text-vagas" },
    servicos: {
      border: "hover:border-servicos/50",
      icon: "bg-servicos/12 text-servicos",
    },
    empresas: {
      border: "hover:border-empresas/50",
      icon: "bg-empresas/12 text-empresas",
    },
  }[tone];

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4 transition-colors hover:bg-panel-2 ${border}`}
    >
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${iconStyle}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted">
          {subtitle}
        </span>
      </span>
      <ArrowRight
        size={16}
        className="flex-none text-faint transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function FeedSection({
  title,
  href,
  accent,
  children,
}: {
  title: string;
  href: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <Link
          href={href}
          className={`inline-flex items-center gap-1 text-xs font-medium ${accent} hover:underline`}
        >
          Ver todas
          <ArrowRight size={13} />
        </Link>
      </div>
      <div className="stagger space-y-2.5">{children}</div>
    </section>
  );
}

function TrustItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-vagas/12 text-vagas">
        {icon}
      </div>
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted">{description}</p>
    </div>
  );
}
