"use client";

import { X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Um passo do tutorial: o que a empresa encontra, e onde. */
export interface PassoDoTutorial {
  titulo: string;
  texto: string;
}

export const CHAVE_DO_TUTORIAL = "lupa:tutorial-do-painel";

/*
 * Fechado nesta visita, mesmo sem storage. Aba anônima estrita e cota cheia
 * fazem o `setItem` falhar, e sem isto "Pular" não fecharia nada.
 */
let fechadoNestaVisita = false;
const ouvintes = new Set<() => void>();

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function jaVisto(): boolean {
  if (fechadoNestaVisita) return true;
  try {
    return localStorage.getItem(CHAVE_DO_TUTORIAL) !== null;
  } catch {
    return false;
  }
}

/** No servidor não se sabe; não desenhar é melhor que piscar e sumir. */
function jaVistoNoServidor(): boolean {
  return true;
}

function marcarComoVisto() {
  fechadoNestaVisita = true;
  try {
    localStorage.setItem(CHAVE_DO_TUTORIAL, new Date().toISOString());
  } catch {
    // Sem storage, vale para esta visita: volta na próxima, e só isso.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O tutorial de primeira visita do painel de contratação (#513).
 *
 * Substitui os três cards de atalho que ficavam no painel — o plano, "Quem
 * já se candidatou" e "Buscar candidatos". Desde as abas (#511) eles só
 * repetiam o caminho, e o Luiz leu um deles sem entender o que era. O que
 * os cards explicavam é dito aqui uma vez, um passo por vez, e some.
 *
 * **"Visto" mora no aparelho, não na conta.** Guardar na conta pediria
 * coluna nova e SQL em produção para uma explicação de quatro passos; o
 * preço é ela aparecer de novo num aparelho novo, o que não custa nada a
 * ninguém. Fecha com "Pular", com o X ou no último passo.
 */
export function TutorialDoPainel({ passos }: { passos: PassoDoTutorial[] }) {
  const visto = useSyncExternalStore(inscrever, jaVisto, jaVistoNoServidor);
  const [atual, setAtual] = useState(0);

  if (visto || passos.length === 0) return null;

  const passo = passos[Math.min(atual, passos.length - 1)];
  const ultimo = atual >= passos.length - 1;

  return (
    <section
      aria-labelledby="tutorial-do-painel"
      className="mb-5 rounded-[var(--radius-card)] border border-empresas/40 bg-panel p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-faint text-xs">
            Como funciona o painel · {atual + 1} de {passos.length}
          </p>
          <h2
            id="tutorial-do-painel"
            className="mt-1 font-bold text-base text-empresas"
          >
            {passo.titulo}
          </h2>
        </div>
        <button
          type="button"
          onClick={marcarComoVisto}
          aria-label="Fechar o tutorial"
          className="-mt-1 -mr-1 flex h-11 w-11 flex-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <p aria-live="polite" className="mt-1 text-muted text-sm leading-relaxed">
        {passo.texto}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ol aria-hidden className="mr-auto flex gap-1.5">
          {passos.map((p, i) => (
            <li
              key={p.titulo}
              className={cn(
                "h-1.5 w-5 rounded-full",
                i <= atual ? "bg-empresas" : "bg-panel-3",
              )}
            />
          ))}
        </ol>
        {ultimo ? (
          <Button variant="empresas" size="md" onClick={marcarComoVisto}>
            Entendi
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="md" onClick={marcarComoVisto}>
              Pular
            </Button>
            <Button
              variant="empresas"
              size="md"
              onClick={() => setAtual((n) => n + 1)}
            >
              Próximo
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
