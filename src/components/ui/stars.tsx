import { Star } from "lucide-react";
import { formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Nota em estrelas. Renderiza meia estrela por recorte, para que 4,5 não
 * apareça arredondado para 5 — a diferença importa na decisão de contratar.
 */
export function Stars({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`Nota ${formatRating(rating)} de 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i + 1));
        return (
          <span
            key={i}
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <Star
              size={size}
              className="absolute inset-0 text-line"
              strokeWidth={1.5}
            />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  size={size}
                  className="text-star"
                  fill="currentColor"
                  strokeWidth={1.5}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Nota compacta usada nos cards: ★ 4,8 (27) */
export function RatingInline({
  rating,
  count,
  className,
}: {
  rating: number;
  count: number;
  className?: string;
}) {
  if (count === 0) {
    return (
      <span className={cn("text-xs text-faint", className)}>Sem avaliações</span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", className)}
      aria-label={`Nota ${formatRating(rating)}, ${count} avaliações`}
    >
      <Star size={12} className="text-star" fill="currentColor" />
      <span className="font-semibold text-ink">{formatRating(rating)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}
