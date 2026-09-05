"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { CHAVE_TEMA, type Tema } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * O tema atual, lido direto do DOM — sem estado próprio de React.
 *
 * `data-theme` no `<html>` já é a fonte da verdade: o script anti-flash
 * de `lib/theme.ts` o define antes da primeira pintura, e este módulo só
 * lê o que já está lá. `useSyncExternalStore` existe exatamente para
 * isto — um valor externo ao React que precisa ser lido de forma
 * diferente no servidor e no cliente, sem arriscar o "texto do servidor
 * não bate com o do cliente" nem precisar de `setState` dentro de um
 * efeito, que é o padrão que a regra `react-hooks/set-state-in-effect`
 * passou a reprovar.
 *
 * Não existe evento de DOM para "atributo mudou" nativamente, e nada
 * fora deste módulo altera `data-theme` — por isso `inscrever` não tem o
 * que ouvir; quem dispara a atualização é a própria `alternar()`, que
 * muda o atributo e chama `notificarMudanca()` na sequência.
 */
const ouvintes = new Set<() => void>();

function inscrever(notificar: () => void): () => void {
  ouvintes.add(notificar);
  return () => ouvintes.delete(notificar);
}

function notificarMudanca(): void {
  for (const notificar of ouvintes) notificar();
}

function lerTemaEscuro(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

/**
 * No servidor não existe `document`, e chutar "claro" esconderia por um
 * instante o ícone certo de quem já escolheu escuro. `null` mantém os
 * dois ícones sobrepostos e transparentes até o valor real do cliente
 * assumir — que, com `data-theme` já certo antes da pintura, acontece
 * junto da hidratação, sem o piscar que um `useEffect` posterior teria.
 */
function lerTemaNoServidor(): boolean | null {
  return null;
}

/**
 * Alterna entre claro (o padrão da plataforma) e escuro (a opção).
 *
 * Mexe direto no atributo do `<html>` e no `localStorage`, sem Context
 * nem Provider: é um interruptor binário, e o "antes da primeira
 * pintura" já está coberto pelo script de `lib/theme.ts`, injetado no
 * `<head>` em `layout.tsx`.
 */
export function AlternarTema({ className }: { className?: string }) {
  const escuro = useSyncExternalStore(
    inscrever,
    lerTemaEscuro,
    lerTemaNoServidor,
  );

  function alternar() {
    const proximo = !escuro;

    if (proximo) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    try {
      const tema: Tema = proximo ? "dark" : "light";
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
      // Sem storage (aba anônima estrita, cota cheia) o toggle ainda
      // funciona para a sessão atual — só não sobrevive a um recarregar.
    }

    notificarMudanca();
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={
        escuro === null
          ? "Alternar tema"
          : escuro
            ? "Mudar para o tema claro"
            : "Mudar para o tema escuro"
      }
      title={escuro ? "Tema claro" : "Tema escuro"}
      className={cn(
        "relative flex h-10 w-10 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-ink",
        className,
      )}
    >
      <Sun
        size={18}
        className={cn(
          "absolute transition-opacity",
          escuro === false ? "opacity-100" : "opacity-0",
        )}
      />
      <Moon
        size={18}
        className={cn(
          "absolute transition-opacity",
          escuro ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}
