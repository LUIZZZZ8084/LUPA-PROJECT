import Image from "next/image";
import { initials } from "@/lib/format";
import { hostsDeImagemRemota } from "@/lib/imagens";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
} as const;

/** O mesmo tamanho, em pixels — é o que o otimizador precisa saber. */
const pixels = { sm: 36, md: 48, lg: 64, xl: 96 } as const;

/**
 * Se a foto vem do Storage do próprio projeto (#267).
 *
 * Só essas passam pelo otimizador. As outras continuam em `<img>`, por duas
 * razões diferentes:
 *
 * - **SVG local** — os avatares de exemplo, em `/avatares`. São poucos KB e
 *   o otimizador do Next não processa SVG.
 * - **Qualquer outro host.** `next/image` só aceita o que está em
 *   `remotePatterns`: em desenvolvimento, um host de fora lança erro; em
 *   produção, o otimizador responde 400 e a foto aparece quebrada. A
 *   pergunta usa `hostsDeImagemRemota()`, a mesma fonte do
 *   `remotePatterns` no `next.config.ts`, para as duas nunca divergirem.
 */
function doNossoStorage(src: string): boolean {
  if (!src.startsWith("https://")) return false;
  try {
    const { hostname } = new URL(src);
    return hostsDeImagemRemota().some((h) => h.hostname === hostname);
  } catch {
    return false;
  }
}

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
  const classes = cn(
    sizes[size],
    shape,
    "flex-none border border-line bg-panel-2 object-cover",
    className,
  );

  /*
   * Foto do Storage vai pelo otimizador, e isto não é detalhe (#267).
   *
   * Era `<img>` para todas: o celular baixava o arquivo que a pessoa
   * enviou. Em produção, uma foto de perfil de 1,9 MB — de um prestador que
   * está na vitrine — era baixada a cada abertura de `/servicos` para
   * desenhar um círculo de 48 px. Pelo otimizador ela chega em WebP, na
   * largura do avatar: 96 ou 128 px, que o `next.config.ts` já declara em
   * `imageSizes`. As fotos do feed já passavam por ele; o avatar, o
   * componente mais repetido do app, era o que tinha ficado de fora.
   */
  if (src && doNossoStorage(src)) {
    return (
      <Image
        src={src}
        alt={name}
        width={pixels[size]}
        height={pixels[size]}
        className={classes}
      />
    );
  }

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
        className={classes}
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
