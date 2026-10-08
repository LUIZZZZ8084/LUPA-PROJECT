import { useId } from "react";
import { cn } from "@/lib/utils";
import { NOME, simbolo } from "./marca";

/**
 * Marca Lupa: uma lupa de aro grosso com uma pessoa dentro.
 *
 * A lupa diz busca; a pessoa, quem se procura. O aro é um degradê de verde
 * (`--logo-a` para `--logo-b`, definidos em `globals.css` para os dois
 * temas), o disco é a cor do texto e a pessoa é a do fundo, então o mesmo
 * desenho serve sobre claro e sobre escuro sem versão separada.
 *
 * O desenho em si está em `marca.tsx`, compartilhado com as imagens geradas
 * em build, que não leem o tema.
 */
export function LupaMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // Um id por instância: duas marcas na mesma tela não compartilham o
  // degradê, e uma delas escondida não leva a outra junto.
  const degrade = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("flex-none", className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={degrade}
          gradientUnits="userSpaceOnUse"
          x1="6"
          y1="4"
          x2="60"
          y2="58"
        >
          <stop offset="0" style={{ stopColor: "var(--logo-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-b)" }} />
        </linearGradient>
      </defs>
      {simbolo({
        aro: `url(#${degrade})`,
        disco: "var(--color-ink)",
        pessoa: "var(--color-bg)",
      })}
    </svg>
  );
}

/**
 * O nome "Lupa" desenhado, com a altura das maiúsculas em 57,5% do tamanho
 * do símbolo — a proporção da logo aprovada. O p desce para fora do quadro
 * (`overflow-visible`) e não desalinha o resto.
 */
function Nome({ size }: { size: number }) {
  const altura = size * 0.575;
  return (
    <svg
      width={(altura * NOME.largura) / NOME.altura}
      height={altura}
      viewBox={NOME.viewBox}
      className="block flex-none overflow-visible"
      role="img"
      aria-label="Lupa"
    >
      <path d={NOME.d} fill="var(--color-ink)" />
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
    <span
      className={cn("inline-flex items-center", className)}
      style={{ gap: size * 0.045 }}
    >
      <LupaMark size={size} />
      <span className="leading-none">
        <Nome size={size} />
        {tagline && (
          <span className="mt-2 block text-[11px] font-medium text-muted">
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
