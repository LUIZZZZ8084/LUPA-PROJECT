"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { CHAVE_TEMA, type Tema } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Alterna entre claro (o padrão da plataforma) e escuro (a opção).
 *
 * Mexe direto no atributo do `<html>` e no `localStorage`, sem Context
 * nem Provider: é um interruptor binário, e o "antes da primeira
 * pintura" já está coberto pelo script de `lib/theme.ts`, injetado no
 * `<head>` em `layout.tsx` — este componente só precisa ler o que já
 * está no DOM e escrever a escolha de volta.
 *
 * O estado nasce `null` de propósito. Componente de cliente roda a mesma
 * função no servidor para gerar o HTML, e lá não existe `document` —
 * chutar "claro" esconderia por um instante o ícone certo de quem já
 * escolheu escuro. `null` renderiza os dois ícones sobrepostos e
 * transparentes até o efeito confirmar qual é o de verdade, o que troca
 * o problema por um piscar de ícone sozinho, não da tela inteira.
 */
export function AlternarTema({ className }: { className?: string }) {
  const [escuro, setEscuro] = useState<boolean | null>(null);

  useEffect(() => {
    setEscuro(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function alternar() {
    const proximo = !escuro;
    setEscuro(proximo);

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
