import { MapPin } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RatingInline } from "@/components/ui/stars";
import { VerifiedMark } from "@/components/verified-badge";
import { WhatsAppIconButton } from "@/components/whatsapp-button";
import { formatStartingPrice } from "@/lib/format";
import { GRAU, grauDeProximidade, type Origem } from "@/lib/proximidade";
import type { ProviderListing } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProviderCard({
  provider,
  perto,
  className,
}: {
  provider: ProviderListing;
  /**
   * De onde quem está olhando está. Só serve para o selo "Perto de você" —
   * a ordem em si já vem pronta da consulta, ver `src/lib/data.ts`.
   */
  perto?: Origem;
  className?: string;
}) {
  const noSeuBairro =
    Boolean(perto?.cidade) &&
    grauDeProximidade(perto, {
      cidade: provider.city,
      bairro: provider.neighborhood,
      atende: provider.service_area,
    }) === GRAU.MESMO_BAIRRO;

  return (
    <div
      className={cn(
        "group relative flex min-w-0 gap-3.5 rounded-[var(--radius-card)] border border-line bg-panel p-4",
        "transition-[background-color,border-color,transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] hover:border-servicos/40 hover:bg-panel-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 active:scale-[0.995] motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <Avatar name={provider.full_name} src={provider.avatar_url} />

      <div className="min-w-0 flex-1">
        {/* O link cobre o card inteiro; o botão do WhatsApp fica acima dele. */}
        <Link
          href={`/servicos/${provider.profile_id}`}
          className="after:absolute after:inset-0 after:content-['']"
        >
          {/* truncate no texto, não no flex — ver comentário em job-card.tsx */}
          <h3 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-ink group-hover:text-servicos">
            <span className="truncate">{provider.full_name}</span>
            {provider.doc_verified && <VerifiedMark size={14} />}
          </h3>
        </Link>

        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-servicos">
          {provider.category.name}
          {noSeuBairro && <Badge tone="servicos">Perto de você</Badge>}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <RatingInline
            rating={provider.avg_rating}
            count={provider.review_count}
          />
          <span className="text-xs font-medium text-ink">
            {formatStartingPrice(provider.starting_price)}
          </span>
        </div>

        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-faint">
          <MapPin size={12} />
          {provider.neighborhood ? `${provider.neighborhood}, ` : ""}
          {provider.city}
          {provider.years_experience
            ? ` · ${provider.years_experience} anos de experiência`
            : ""}
        </p>
      </div>

      <div className="relative z-10 self-center">
        <WhatsAppIconButton
          phone={provider.phone}
          providerName={provider.full_name}
          context={provider.category.name}
        />
      </div>
    </div>
  );
}
