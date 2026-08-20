import { cn } from "@/lib/utils";

/**
 * Marca Lupa: lente de aumento com um "check" dentro.
 * A lente comunica busca; o check, a verificação de perfil — os dois
 * diferenciais do produto no mesmo símbolo.
 */
export function LupaMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("flex-none", className)}
      aria-hidden
    >
      <circle
        cx="21"
        cy="21"
        r="14"
        stroke="currentColor"
        strokeWidth="4"
        className="text-vagas"
      />
      <line
        x1="31"
        y1="31"
        x2="43"
        y2="43"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className="text-vagas"
      />
      <path
        d="M15 21 L19 25 L28 15"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-ink"
      />
    </svg>
  );
}

export function LupaLogo({
  size = 32,
  tagline,
  className,
}: {
  size?: number;
  tagline?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LupaMark size={size} />
      <span className="leading-none">
        <span
          className="block font-bold tracking-tight"
          style={{ fontSize: size * 0.72 }}
        >
          Lupa
        </span>
        {tagline && (
          <span className="mt-1 block text-[11px] font-medium text-muted">
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
