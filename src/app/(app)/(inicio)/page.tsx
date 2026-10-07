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
import { headers } from "next/headers";
import Link from "next/link";
import { BannerDaHome } from "@/components/banner-da-home";
import { BuscaDoHero } from "@/components/busca-do-hero";
import { JobCard } from "@/components/job-card";
import { PageShell } from "@/components/layout/page-shell";
import { Reveal } from "@/components/motion/reveal";
import { ProfissionaisEmLinha } from "@/components/profissionais-em-linha";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { UFS } from "@/lib/cidades";
import { getHomeFeed } from "@/lib/data";
import { formatPrecoBRL } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { origemDoUsuario } from "@/server/auth/origem";
import { type Papel, pode } from "@/server/auth/rbac";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";

/**
 * O terceiro card, decidido pelo papel de quem está olhando — e, desde a
 * #241, também por não ter papel nenhum.
 *
 * Ele apontava sempre para `/cadastro?tipo=prestador_servico` — a tela de
 * criar conta. Isso fazia sentido quando ninguém via esta home sem sessão:
 * mandar quem já tem conta para o cadastro seria pedir que ela mantivesse
 * duas e não achasse nenhuma depois. Hoje a home é o primeiro lugar que um
 * visitante vê, e para ele o card precisa voltar a ser exatamente aquele
 * convite — só que sem prometer um papel que ele ainda não escolheu.
 *
 * Quem pode ativar (candidato) vai para a ativação; quem já é prestador vai
 * para o próprio perfil, que é onde ele edita o anúncio; para os outros
 * papéis com sessão o card deixa de prometer o que não se aplica a eles; e
 * sem sessão nenhuma, o card é o cadastro.
 */
function cardDeServico(papel: Papel | undefined, autenticado: boolean) {
  if (papel && pode(papel, "prestador:ativar")) {
    return {
      href: "/perfil/virar-prestador",
      titulo: "Oferecer serviço",
      legenda: "Divulgue suas habilidades",
    };
  }

  if (papel === "prestador_servico") {
    return {
      href: "/perfil",
      titulo: "Meu perfil de prestador",
      legenda: "Edite seu anúncio",
    };
  }

  if (!autenticado) {
    return {
      href: "/cadastro",
      titulo: "Criar minha conta",
      legenda: "Grátis, leva menos de 1 minuto",
    };
  }

  return {
    href: "/perfil",
    titulo: "Meu perfil",
    legenda: "Seus dados e verificação",
  };
}

export default async function HomePage() {
  // Os destaques também vêm do mais perto para o mais longe: a home é a
  // primeira impressão, e quatro vagas de Cuiabá para quem é de Sinop
  // dizem que o app não é da cidade dela.
  const origem = await origemDoUsuario();
  const { jobs, providers, totals } = await getHomeFeed(origem);
  const sessao = await sessaoAtual();
  const terceiroCard = cardDeServico(sessao?.papel, Boolean(sessao));

  /*
   * O JSON-LD é assinado com o mesmo nonce da CSP (#223) — sem ele, a
   * política de script-src recusaria este `<script>` do mesmo jeito que
   * recusaria um script de verdade. `type="application/ld+json"` não roda
   * nada, mas o navegador não distingue isso ao aplicar a política.
   */
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lupa",
    url: "https://lupapp.com.br",
    description:
      "Plataforma de vagas de emprego e prestação de serviços, com o que " +
      "está mais perto de quem procura primeiro.",
    areaServed: {
      "@type": "Country",
      name: "Brasil",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON.stringify de dado nosso, não de entrada.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="aurora border-b border-line">
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-8 sm:px-6 sm:pt-10 sm:pb-12">
          <BannerDaHome />

          <div className="mt-4 sm:mt-6">
            {/*
             * O pino de localização promete "aqui é onde você está" — e até
             * a #107 dizia sempre "Mato Grosso · começando por Sinop",
             * pra quem quer que fosse, de qualquer cidade. `origemDoUsuario()`
             * já lê a cidade da conta para ordenar a busca por perto; usar o
             * mesmo valor aqui é a diferença entre um selo de abrangência e
             * uma promessa que o ícone já fazia sem cumprir.
             *
             * Sem sessão (a home é pública desde a #241), ou com uma conta
             * sem cidade, o selo diz o alcance do app — o Brasil inteiro
             * desde a #301 — em vez de mostrar um pino sem legenda. A cidade
             * já é gravada com o estado ("Sinop - MT"), então não há rótulo
             * a montar.
             */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel/60 px-3 py-1 text-[11px] font-medium text-muted">
              <MapPin size={12} className="text-vagas" />
              {origem?.cidade ?? "Vagas e serviços em todo o Brasil"}
            </span>
          </div>

          <BuscaDoHero
            ufs={UFS.map((u) => ({ sigla: u.sigla, nome: u.nome }))}
            visitante={!sessao}
          />

          <FaixaDeNumeros
            vagas={totals.jobs}
            vagasAoMenos={totals.jobsAoMenos}
            profissionais={totals.providers}
            profissionaisAoMenos={totals.providersAoMenos}
          />

          {/*
           * Para quem não tem conta, o card de conta fica aqui no alto, que
           * é onde converte (#241). Para quem já entrou, ele é um atalho
           * para o próprio perfil, e vai para o fim da lista.
           */}
          {!sessao && (
            <div className="mt-3 max-w-sm">
              <CardDeConta card={terceiroCard} />
            </div>
          )}
        </div>
      </section>

      <PageShell>
        <div className="space-y-8">
          {/*
           * No celular as vagas rolam para o lado, uma e meia à vista, para
           * dizer que há mais sem ocupar a tela. A partir de `sm` viram a
           * grade de duas colunas, porque rolagem lateral no desktop é pior
           * que ver as quatro de uma vez. O respiro vertical (`py-2` com
           * `-my-2`) é para a sombra e a subida do card no hover não serem
           * cortadas pelo `overflow`.
           */}
          <FeedSection
            title="Vagas em destaque"
            href="/vagas"
            accent="text-vagas"
            listaClassName="no-scrollbar stagger -mx-4 -my-2 flex scroll-px-4 snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-2 grid-cols-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0"
            vazio={
              jobs.length === 0 && (
                <Vazio
                  texto="Nenhuma vaga aberta no momento."
                  acao="Contrata? Publique a primeira"
                  href="/empresa"
                />
              )
            }
          >
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                className="w-[17rem] flex-none snap-start sm:w-auto"
              />
            ))}
          </FeedSection>

          <FeedSection
            title="Profissionais bem avaliados"
            href="/servicos"
            accent="text-servicos"
            listaClassName=""
            vazio={
              providers.length === 0 && (
                <Vazio
                  texto="Nenhum profissional na vitrine ainda."
                  acao="Oferece um serviço? Apareça aqui"
                  href={terceiroCard.href}
                />
              )
            }
          >
            <ProfissionaisEmLinha providers={providers} />
          </FeedSection>

          {sessao && (
            <div className="max-w-sm">
              <CardDeConta card={terceiroCard} />
            </div>
          )}
        </div>

        {/* Confiança — o que faz alguém contratar um desconhecido */}
        <Reveal>
          {/*
            Este bloco anunciava três verificações que o produto não entrega
            (#237), na tela onde alguém decide deixar um estranho entrar em
            casa.

            "Telefone verificado" não existe — nada no código escreve
            `telefone_verificado = true`, e os 14 perfis que exibiam o selo
            em produção eram todos do seed. "Identidade confirmada" é a
            alegação mais forte possível e a mais falsa: CPF válido e único
            não prova que o documento é de quem o digitou, como os próprios
            Termos de Uso dizem. E "a experiência de quem já contratou"
            descrevia 17 avaliações das quais 16 eram semeadas — e nada liga
            avaliação a contratação.

            O que ficou é o que de fato é conferido, **com o alcance de cada
            conferência dito junto**. Selo que promete mais do que confere
            substitui o cuidado da pessoa por uma garantia que ninguém deu —
            e é pior que selo nenhum, porque ela para de olhar.
          */}
          <Panel className="mt-10">
            <h2 className="text-lg font-bold">
              O que a gente <span className="text-vagas">confere</span>
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-muted">
              E o que cada conferência prova, para você saber o que ainda
              depende de você antes de contratar alguém.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
              <TrustItem
                icon={<BadgeCheck size={22} />}
                title="CNPJ na Receita"
                description="Conferimos que a empresa existe e está ativa"
              />
              <TrustItem
                icon={<ShieldCheck size={22} />}
                title="Um CPF, uma conta"
                description="Válido e sem repetir — não prova de quem é"
              />
              <TrustItem
                icon={<Star size={22} />}
                title="Uma avaliação por pessoa"
                description="E ninguém avalia a si mesmo"
              />
              <TrustItem
                icon={<MessageCircle size={22} />}
                title="Gente daqui"
                description="Da sua cidade e da sua região"
              />
            </div>

            {/*
              A frase que faltava.

              Nenhuma das quatro conferências prova quem a pessoa é, e quem
              vai abrir a porta de casa merece saber disso antes, não depois.
              Sem alarde: produtor rural e autônomo contratam de verdade, e
              tratar todo mundo como suspeito afastaria justamente quem o app
              existe para atender.
            */}
            <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
              Nada disso prova quem a pessoa é. Combine o primeiro encontro num
              lugar movimentado, confira o serviço antes de pagar, e desconfie
              de quem cobra qualquer taxa para você se candidatar — isso não
              existe na Lupa.
            </p>
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
                    {/*
                      O preço vem de `PRECO_CENTAVOS`, nunca escrito à mão
                      aqui: preço repetido na tela e no servidor é como se
                      anuncia um valor e se cobra outro — e esta frase já
                      mentiu uma vez, quando dizia "a primeira vaga é
                      gratuita" meses depois de publicar passar a custar.
                    */}
                    Publique vagas, receba currículos organizados e acompanhe
                    visualizações. A partir de{" "}
                    {formatPrecoBRL(PRECO_CENTAVOS.empresa_vaga_avulsa / 100)}{" "}
                    por vaga.
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

        {/*
         * Direitos autorais, não área de cobertura.
         *
         * Dizia "aberto a todo o Mato Grosso · começamos por Sinop" — a
         * cobertura geográfica já está clara na home inteira (filtro de
         * cidade, badge do topo); rodapé é onde se espera outra coisa.
         *
         * "Palu" é "Lupa" com as duas metades trocadas: LU (Luiz) + PA
         * (Paulinho) virou PA + LU — a mesma lógica de fundação do nome
         * do produto, agora para a pessoa jurídica por trás dele.
         */}
        <p className="mt-8 text-center text-xs text-faint">
          Lupa · © {new Date().getFullYear()} Palu Soluções Digitais. Todos os
          direitos reservados.
        </p>
      </PageShell>
    </>
  );
}

/** O card de conta, do jeito que o papel pede (ver `cardDeServico`). */
function CardDeConta({
  card,
}: {
  card: { href: string; titulo: string; legenda: string };
}) {
  return (
    <ActionCard
      href={card.href}
      icon={<Users size={20} />}
      title={card.titulo}
      subtitle={card.legenda}
      tone="empresas"
    />
  );
}

/**
 * Quantas vagas e quantos profissionais há, cada número um link para a
 * lista (#372).
 *
 * `aoMenos` é o "mais de" que a contagem já carregava: quando a consulta
 * bate no teto, o número é um piso, e escrever "100" seria afirmar uma
 * conta que ninguém fez. Aqui vira "100+".
 */
function FaixaDeNumeros({
  vagas,
  vagasAoMenos,
  profissionais,
  profissionaisAoMenos,
}: {
  vagas: number;
  vagasAoMenos: boolean;
  profissionais: number;
  profissionaisAoMenos: boolean;
}) {
  return (
    <div className="mt-4 grid max-w-2xl grid-cols-2 divide-x divide-vagas/20 overflow-hidden rounded-2xl bg-vagas/10">
      <NumeroLink
        href="/vagas"
        icone={<Briefcase size={24} className="text-vagas" />}
        numero={`${vagas}${vagasAoMenos ? "+" : ""}`}
        rotulo="vagas abertas"
      />
      <NumeroLink
        href="/servicos"
        icone={<Wrench size={24} className="text-servicos" />}
        numero={`${profissionais}${profissionaisAoMenos ? "+" : ""}`}
        rotulo="profissionais"
      />
    </div>
  );
}

function NumeroLink({
  href,
  icone,
  numero,
  rotulo,
}: {
  href: string;
  icone: React.ReactNode;
  numero: string;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-vagas/10"
    >
      {icone}
      <span className="flex flex-col leading-tight">
        <span className="font-bold text-xl tabular-nums tracking-tight">
          {numero}
        </span>
        <span className="text-muted text-xs">{rotulo}</span>
      </span>
    </Link>
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
  vazio,
  listaClassName,
  children,
}: {
  title: string;
  href: string;
  accent: string;
  /** Como a lista se organiza; por padrão, empilhada com entrada em cascata. */
  listaClassName?: string;
  /**
   * O que aparece quando não há nada para listar (#302). Sem os dados de
   * exemplo, a vitrine de produção começa quase vazia — e uma seção só com
   * o título parece tela quebrada, não começo.
   */
  vazio?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{title}</h2>
        <Link
          href={href}
          className={`-my-2 inline-flex min-h-11 items-center gap-1 pl-3 text-xs font-medium ${accent} hover:underline`}
        >
          Ver todas
          <ArrowRight size={13} />
        </Link>
      </div>
      {vazio || (
        <div className={listaClassName ?? "stagger space-y-2.5"}>
          {children}
        </div>
      )}
    </section>
  );
}

function Vazio({
  texto,
  acao,
  href,
}: {
  texto: string;
  acao: string;
  href: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line border-dashed bg-panel p-5 text-center">
      <p className="text-muted text-sm">{texto}</p>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 font-medium text-ink text-sm hover:underline"
      >
        {acao}
        <ArrowRight size={14} />
      </Link>
    </div>
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
