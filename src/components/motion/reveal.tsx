"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

type Estado = "servidor" | "aguardando" | "visivel";

/**
 * Revela o bloco quando ele entra na tela.
 *
 * Três decisões importantes:
 *
 * 1. No HTML do servidor o conteúdo já vem visível. Se começasse com
 *    opacity: 0, quem estivesse sem JavaScript — ou com ele ainda
 *    carregando — ficaria olhando para uma página em branco. Enfeite nunca
 *    pode ser condição para o conteúdo existir.
 *
 * 2. O que já está na tela no primeiro quadro não anima. Animar a entrada
 *    do que a pessoa veio ler só atrasa a leitura; a animação serve para
 *    explicar que algo chegou depois.
 *
 * 3. A observação é montada num callback de ref, não num efeito. O
 *    callback roda no momento em que o nó existe, que é exatamente quando
 *    dá para medir a posição — e evita o ciclo extra de renderização que
 *    um setState dentro de efeito provoca.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Atraso em ms, para escalonar blocos irmãos. */
  delay?: number;
}) {
  const [estado, setEstado] = useState<Estado>("servidor");

  const observar = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setEstado("visivel");
      return;
    }

    // Já estava à vista quando montou: nada a revelar.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setEstado("visivel");
      return;
    }

    setEstado("aguardando");

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setEstado("visivel");
          observer.disconnect();
        }
      },
      // Começa um pouco antes de entrar na tela, para o movimento terminar
      // quando o olho chegar.
      { rootMargin: "80px", threshold: 0.05 },
    );

    observer.observe(el);

    // React 19 chama esta função quando o nó sai.
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={observar}
      style={
        estado === "visivel" && delay
          ? { animationDelay: `${delay}ms` }
          : undefined
      }
      className={cn(
        estado === "aguardando" && "opacity-0",
        estado === "visivel" && "animate-[var(--animate-fade-up)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
