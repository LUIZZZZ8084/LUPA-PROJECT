"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barra de progresso do topo durante a navegação.
 *
 * Os arquivos loading.tsx cobrem a espera depois que a rota troca, mas
 * existe um intervalo antes disso — o servidor ainda está respondendo e a
 * tela continua parada. Em 3G esse intervalo passa de um segundo, e sem
 * sinal nenhum a pessoa toca de novo no mesmo link.
 *
 * Deliberadamente sem useSearchParams: o hook exigiria um <Suspense> em
 * volta deste componente no layout raiz, e esse boundary já nos custou a
 * barra de filtros inteira. A troca de filtro tem indicador próprio, no
 * campo de busca.
 */

/** Em navegação instantânea, um lampejo de barra incomoda mais do que ajuda. */
const ATRASO_ATE_APARECER = 120;
/** Rede caiu no meio: a barra some sozinha em vez de girar para sempre. */
const TEMPO_MAXIMO = 10_000;

export function RouteProgress() {
  const pathname = usePathname();
  const [visivel, setVisivel] = useState(false);
  const [rotaDeOrigem, setRotaDeOrigem] = useState(pathname);

  // A navegação terminou quando a rota muda. Ajuste durante a renderização
  // para a barra sumir no mesmo quadro em que a página nova aparece.
  if (pathname !== rotaDeOrigem) {
    setRotaDeOrigem(pathname);
    if (visivel) setVisivel(false);
  }

  useEffect(() => {
    // Os cronômetros são locais ao efeito: a cada rota nova o efeito é
    // recriado e a limpeza cancela o que tiver ficado pendente da anterior.
    let aparecer: ReturnType<typeof setTimeout> | undefined;
    let desistir: ReturnType<typeof setTimeout> | undefined;

    function iniciar() {
      clearTimeout(aparecer);
      clearTimeout(desistir);
      aparecer = setTimeout(() => setVisivel(true), ATRASO_ATE_APARECER);
      desistir = setTimeout(() => setVisivel(false), TEMPO_MAXIMO);
    }

    function aoClicar(evento: MouseEvent) {
      // Clique com modificador abre em outra aba: não é navegação daqui.
      if (
        evento.defaultPrevented ||
        evento.button !== 0 ||
        evento.metaKey ||
        evento.ctrlKey ||
        evento.shiftKey ||
        evento.altKey
      ) {
        return;
      }

      const alvo = (evento.target as HTMLElement | null)?.closest("a");
      if (!alvo) return;

      const href = alvo.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (alvo.target && alvo.target !== "_self") return;

      // Links externos (WhatsApp, por exemplo) saem do app.
      const url = new URL(alvo.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.search === window.location.search) {
        return;
      }

      iniciar();
    }

    document.addEventListener("click", aoClicar);
    window.addEventListener("popstate", iniciar);

    return () => {
      document.removeEventListener("click", aoClicar);
      window.removeEventListener("popstate", iniciar);
      clearTimeout(aparecer);
      clearTimeout(desistir);
    };
  }, [pathname]);

  if (!visivel) return null;

  return (
    // role="progressbar" em vez de <progress>: o elemento nativo não aceita
    // estado indeterminado com animação própria nem é estilizável assim.
    <div
      role="progressbar"
      aria-label="Carregando página"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div className="h-full w-full origin-left animate-[var(--animate-progress)] bg-vagas" />
    </div>
  );
}
