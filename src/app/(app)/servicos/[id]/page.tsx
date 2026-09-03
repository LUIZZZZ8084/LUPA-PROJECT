import { Banknote, Briefcase, Check, MapPin, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, PageShell } from "@/components/layout/page-shell";
import { ProviderCard } from "@/components/provider-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import {
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
} from "@/components/ui/skeleton";
import { RatingInline } from "@/components/ui/stars";
import { VerificationRow, VerifiedMark } from "@/components/verified-badge";
import { WhatsAppButton } from "@/components/whatsapp-button";
import {
  getProviderById,
  getProviders,
  getReviews,
  ratingBreakdown,
} from "@/lib/data";
import { formatStartingPrice } from "@/lib/format";
import { sessaoAtual } from "@/server/auth/cookies";
import { pode } from "@/server/auth/rbac";
import { jaAvaliou } from "@/server/avaliacoes/servico";
import { listarPublicacoes } from "@/server/publicacoes/servico";
import { FormularioDeAvaliacao } from "./avaliar";

/**
 * As avaliações ficam abaixo da dobra e crescem sem limite — um prestador
 * antigo terá dezenas. Carregar sob demanda tira esse peso do primeiro
 * carregamento, que é o que decide se a pessoa espera ou desiste no 3G.
 */
const ReviewsPanel = dynamic(
  () => import("@/components/reviews-panel").then((m) => m.ReviewsPanel),
  {
    loading: () => (
      <Panel className="mt-5">
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 flex items-center gap-6">
          <div className="space-y-2 text-center">
            <Skeleton className="h-10 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex-1 space-y-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-1.5 w-full rounded-full" />
            ))}
          </div>
        </div>
        <div className="mt-6 space-y-4 border-t border-line pt-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <SkeletonAvatar size="sm" />
              <div className="flex-1 space-y-2">
                <SkeletonText w="w-32" className="h-3" />
                <SkeletonText />
                <SkeletonText w="w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    ),
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const provider = await getProviderById(id);
  if (!provider) return { title: "Profissional não encontrado" };
  return {
    title: `${provider.full_name} — ${provider.category.name} em ${provider.city}`,
    description:
      provider.description?.slice(0, 155) ??
      `${provider.category.name} em ${provider.city}.`,
  };
}

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const provider = await getProviderById(id);
  if (!provider) notFound();

  const sessao = await sessaoAtual();
  const reviews = await getReviews(id);

  /*
   * Só o que está no feed. Arquivado é trabalho que o prestador tirou de
   * exibição — mostrar aqui ignoraria a escolha dele.
   */
  const trabalhos = await listarPublicacoes(id, "ativa");

  /*
   * O formulário de avaliação só aparece para quem pode usá-lo.
   *
   * O painel logo abaixo já convidava a avaliar sem oferecer nada para
   * clicar. Mostrar o formulário a quem não pode enviar seria o inverso do
   * mesmo erro: promessa que a action recusa depois do clique.
   */
  const jaAvaliouEste = await jaAvaliou(sessao, provider.profile_id);

  const podeAvaliar =
    Boolean(sessao && pode(sessao.papel, "avaliacao:escrever")) &&
    sessao?.usuarioId !== provider.profile_id &&
    !jaAvaliouEste;
  const breakdown = ratingBreakdown(reviews);

  const similar = (
    await getProviders({
      category: provider.category.slug,
      city: provider.city,
    })
  )
    .filter((p) => p.profile_id !== provider.profile_id)
    .slice(0, 2);

  return (
    <PageShell width="narrow">
      <BackLink href="/servicos" label="Voltar para serviços" />

      {/*
       * Perfil não verificado abre, mas diz o que é.
       *
       * A busca só mostra quem passou pela fila do admin — mas o perfil
       * continua alcançável por link direto, e precisa ser honesto com as
       * duas pessoas que chegam aqui: o visitante, que merece saber que
       * ninguém conferiu este anúncio ainda; e o próprio prestador, que
       * de outro modo não entenderia por que não se acha na busca.
       */}
      {!provider.doc_verified && (
        <Panel className="mb-5 border-warn/30 bg-warn/8">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 flex-none text-warn" />
            <div>
              <h2 className="font-bold text-base">Perfil em análise</h2>
              <p className="mt-1.5 text-muted text-sm leading-relaxed">
                O documento deste profissional ainda não foi conferido pela
                Lupa, então ele não aparece na busca de serviços. Se este perfil
                é seu, envie documento e selfie em{" "}
                <Link
                  href="/perfil/editar"
                  className="underline hover:text-ink"
                >
                  Editar perfil
                </Link>
                .
              </p>
            </div>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
          <div className="relative">
            <Avatar
              name={provider.full_name}
              src={provider.avatar_url}
              size="xl"
            />
            {provider.doc_verified && (
              <span className="absolute right-0 bottom-0 rounded-full bg-panel p-0.5">
                <VerifiedMark size={22} />
              </span>
            )}
          </div>

          <div className="mt-4 min-w-0 flex-1 sm:mt-0 sm:ml-5">
            <h1 className="text-2xl font-bold tracking-tight">
              {provider.full_name}
            </h1>
            <p className="mt-1 text-sm font-medium text-servicos">
              {provider.category.name}
            </p>
            <div className="mt-2.5 flex justify-center sm:justify-start">
              <RatingInline
                rating={provider.avg_rating}
                count={provider.review_count}
              />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted sm:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} />
                {provider.neighborhood
                  ? `${provider.neighborhood}, ${provider.city}`
                  : provider.city}
              </span>
              {provider.years_experience && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={13} />
                  {provider.years_experience} anos de experiência
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                <Banknote size={13} className="text-servicos" />
                {formatStartingPrice(provider.starting_price)}
              </span>
            </div>
          </div>
        </div>

        <VerificationRow
          className="mt-5 justify-center sm:justify-start"
          phoneVerified={provider.phone_verified}
          docVerified={provider.doc_verified}
        />

        {provider.description && (
          <div className="mt-6 border-t border-line pt-5">
            <h2 className="mb-2.5 text-sm font-semibold">Sobre mim</h2>
            <p className="text-sm leading-relaxed text-muted">
              {provider.description}
            </p>
          </div>
        )}

        {provider.service_area.length > 0 && (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="mb-2.5 text-sm font-semibold">Bairros atendidos</h2>
            <div className="flex flex-wrap gap-2">
              {provider.service_area.map((area) => (
                <Badge key={area} tone="outline">
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(provider.instagram || provider.facebook) && (
          <div className="mt-5 flex items-center gap-4 border-t border-line pt-5">
            {provider.instagram && (
              <a
                href={provider.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted underline-offset-2 transition-colors hover:text-servicos hover:underline"
              >
                Instagram
              </a>
            )}
            {provider.facebook && (
              <a
                href={provider.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted underline-offset-2 transition-colors hover:text-servicos hover:underline"
              >
                Facebook
              </a>
            )}
          </div>
        )}

        <div className="mt-6 border-t border-line pt-5">
          <WhatsAppButton
            phone={provider.phone}
            providerName={provider.full_name}
            context={provider.category.name}
            size="lg"
            block
          />
          <p className="mt-2 text-center text-[11px] text-faint">
            A conversa acontece direto no seu WhatsApp. A Lupa não cobra nada de
            quem contrata.
          </p>
        </div>
      </Panel>

      {/*
       * Os trabalhos publicados.
       *
       * Vem antes das avaliações de propósito: quem procura um eletricista
       * decide primeiro olhando o que ele já fez, e só depois lê o que os
       * outros acharam.
       */}
      {trabalhos.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 font-bold text-base">Trabalhos publicados</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {trabalhos.map((t) => (
              <Panel key={t.id} className="overflow-hidden">
                {t.imagemUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  // biome-ignore lint/performance/noImgElement: mesma razão do feed — o host do Storage não está nos `remotePatterns`, e trocar isso é mudança de build.
                  <img
                    src={t.imagemUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="-mx-5 -mt-5 mb-4 h-40 w-[calc(100%+2.5rem)] object-cover"
                  />
                )}
                <h3 className="font-semibold text-sm">{t.titulo}</h3>
                <p className="mt-1.5 whitespace-pre-line text-muted text-sm leading-relaxed">
                  {t.corpo}
                </p>
              </Panel>
            ))}
          </div>
        </section>
      )}

      {podeAvaliar && (
        <FormularioDeAvaliacao
          prestadorId={provider.profile_id}
          nomeDoPrestador={provider.full_name}
        />
      )}

      {/*
       * A confirmação vem do servidor, não do estado do formulário.
       *
       * A action revalida esta rota — a nota média muda —, e a revalidação
       * desmonta o formulário junto com o "enviado" que ele mostrava. Quem
       * acabava de avaliar via o formulário simplesmente sumir, sem
       * confirmação nenhuma. É a mesma armadilha do 404 depois de virar
       * prestador: estado de cliente não sobrevive à revalidação da
       * própria rota.
       */}
      {jaAvaliouEste && (
        <Panel className="mt-5 border-vagas/30 bg-vagas/8">
          <div className="flex items-start gap-3">
            <Check size={20} className="mt-0.5 flex-none text-vagas" />
            <div>
              <h2 className="font-bold text-base">Você já avaliou</h2>
              <p className="mt-1.5 text-muted text-sm leading-relaxed">
                Sua avaliação está na lista abaixo. Cada pessoa avalia uma vez —
                é o que mantém a nota honesta.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Avaliações — carregado sob demanda, ver ReviewsPanel */}
      <ReviewsPanel
        reviews={reviews}
        avgRating={provider.avg_rating}
        reviewCount={provider.review_count}
        breakdown={breakdown}
      />

      {similar.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-bold">
            Outros {provider.category.name.toLowerCase()}s em {provider.city}
          </h2>
          <div className="space-y-2.5">
            {similar.map((p) => (
              <ProviderCard key={p.profile_id} provider={p} />
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
}
