import { Avatar } from "@/components/ui/avatar";
import { Panel } from "@/components/ui/card";
import { Stars } from "@/components/ui/stars";
import { formatRating, timeAgo } from "@/lib/format";
import type { Review } from "@/lib/types";

/**
 * Bloco de avaliações do perfil do prestador.
 *
 * Fica abaixo da dobra e cresce com o tempo — um prestador antigo pode ter
 * dezenas de comentários. Por isso é carregado sob demanda pelo
 * next/dynamic no perfil, e não junto com o restante da tela.
 */
export function ReviewsPanel({
  reviews,
  avgRating,
  reviewCount,
  breakdown,
}: {
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  breakdown: Record<number, number>;
}) {
  return (
    <Panel className="mt-5">
      <h2 className="text-base font-bold">Avaliações</h2>

      {reviewCount === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Este profissional ainda não recebeu avaliações. Foi atendido por ele?
          Depois do serviço, sua avaliação ajuda a próxima pessoa.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold tabular-nums">
                {formatRating(avgRating)}
              </div>
              <Stars rating={avgRating} className="mt-1.5" />
              <p className="mt-1.5 text-[11px] text-muted">
                {reviewCount} avaliações
              </p>
            </div>

            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = breakdown[star] ?? 0;
                const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-2 text-[11px] text-muted tabular-nums">
                      {star}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-3">
                      {/* A barra cresce da esquerda ao entrar na tela. */}
                      <div
                        className="h-full origin-left rounded-full bg-vagas transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-5 text-right text-[11px] text-faint tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="stagger mt-6 divide-y divide-line border-t border-line">
            {reviews.map((review) => (
              <li key={review.id} className="py-4">
                <div className="flex items-start gap-3">
                  <Avatar name={review.reviewer_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold">
                        {review.reviewer_name}
                      </span>
                      <Stars rating={review.rating} size={12} />
                      <span className="text-[11px] text-faint">
                        {timeAgo(review.created_at)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
