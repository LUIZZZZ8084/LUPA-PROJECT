import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
} as const;

/**
 * Avatar com iniciais. O V0 não exige foto no cadastro, então as iniciais
 * sobre gradiente são o estado padrão — e não o placeholder quebrado.
 */
export function Avatar({
  name,
  src,
  size = "md",
  square = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  square?: boolean;
  className?: string;
}) {
  const shape = square ? "rounded-xl" : "rounded-full";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        // Cards de busca podem ter dezenas de fotos abaixo da dobra;
        // baixar todas de uma vez em 3G derruba o carregamento inicial.
        loading="lazy"
        decoding="async"
        className={cn(
          sizes[size],
          shape,
          "flex-none border border-line bg-panel-2 object-cover",
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        sizes[size],
        shape,
        "flex flex-none items-center justify-center border border-line",
        "bg-gradient-to-br from-panel-3 to-panel-2 font-semibold text-muted",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
