"use client";

import { Download, Ellipsis, EllipsisVertical, Share, X } from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  aparelhoDoNavegador,
  EVENTO_INSTALAVEL,
  type Oferta,
  ofertaDeInstalacao,
} from "@/lib/instalacao";

/*
 * O estado do convite mora fora do React, como o tema em `theme-toggle.tsx`:
 * o pedido de instalação chega por um evento do navegador, guardado em
 * `window` pelo script do `<head>`, e "Agora não" vale para a visita inteira
 * — trocar de tela não traz o convite de volta; abrir a Lupa de novo, sim.
 * Por isso a dispensa mora no módulo, e não no aparelho.
 * `useSyncExternalStore` lê os dois sem `setState` dentro de efeito.
 */
const ouvintes = new Set<() => void>();
let jaEstaNoAparelho = false;
let dispensadoNestaVisita = false;
let conferiuOAparelho = false;

function avisar(): void {
  for (const notificar of ouvintes) notificar();
}

/**
 * O Android diz se o app já está instalado, pelo `related_applications` do
 * manifesto. Sem isto, quem instalou e voltou ao site pelo Chrome veria o
 * passo a passo de algo que já tem. Os outros navegadores não respondem, e
 * aí o convite segue — "Agora não" o esconde.
 */
function conferirOAparelho(): void {
  if (conferiuOAparelho) return;
  conferiuOAparelho = true;
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  };
  nav
    .getInstalledRelatedApps?.()
    .then((apps) => {
      if (apps.length === 0) return;
      jaEstaNoAparelho = true;
      avisar();
    })
    .catch(() => {});
}

function inscrever(notificar: () => void): () => void {
  ouvintes.add(notificar);
  window.addEventListener(EVENTO_INSTALAVEL, notificar);
  conferirOAparelho();
  return () => {
    ouvintes.delete(notificar);
    window.removeEventListener(EVENTO_INSTALAVEL, notificar);
  };
}

/** Aberto pela tela inicial: sem barra de navegador, já é o app. */
function abertoComoApp(): boolean {
  if ((navigator as Navigator & { standalone?: boolean }).standalone) {
    return true;
  }
  return ["standalone", "fullscreen", "minimal-ui"].some(
    (modo) => window.matchMedia?.(`(display-mode: ${modo})`)?.matches === true,
  );
}

function lerOferta(): Oferta {
  return ofertaDeInstalacao({
    aparelho: aparelhoDoNavegador(
      navigator.userAgent,
      navigator.maxTouchPoints ?? 0,
    ),
    instalado:
      jaEstaNoAparelho || window.__lupaInstalado === true || abertoComoApp(),
    dispensado: dispensadoNestaVisita,
    temPedido: Boolean(window.__lupaPedidoDeInstalacao),
  });
}

/** O servidor não sabe que aparelho é; o convite só nasce no navegador. */
function nadaNoServidor(): Oferta {
  return "nenhuma";
}

/**
 * Abre a janela de instalar do navegador.
 *
 * O pedido vale uma vez só: usado — aceito, recusado ou com erro —, o
 * próximo toque mostra o caminho pelo menu.
 */
async function pedirInstalacao(): Promise<void> {
  const pedido = window.__lupaPedidoDeInstalacao;
  if (!pedido) return;
  window.__lupaPedidoDeInstalacao = null;
  try {
    await pedido.prompt();
    const { outcome } = await pedido.userChoice;
    if (outcome === "accepted") jaEstaNoAparelho = true;
  } catch {
    // O navegador recusou abrir a janela; o menu continua sendo o caminho.
  }
  avisar();
}

function dispensar(): void {
  dispensadoNestaVisita = true;
  avisar();
}

/**
 * O convite para instalar a Lupa, para quem está no navegador do celular
 * (#475). No Android que já entregou o pedido, o toque instala; nos outros
 * casos, a frase da faixa vira uma dica de uma linha dizendo onde tocar. A
 * regra de quem vê o quê mora em `src/lib/instalacao.ts`.
 *
 * **A dica toma o lugar da frase, e a faixa não cresce (#477).** Nasceu
 * abrindo uma caixa com três passos e uma nota embaixo da faixa, e no
 * iPhone ela ocupava quase metade da tela. O Luiz pediu só o botão. Só o
 * botão não basta onde ele não pode instalar — a Apple não deixa —, então
 * o que sobrou é o mínimo: o desenho do botão Compartilhar e o nome da
 * opção, no espaço que a frase já usava.
 */
export function InstalarApp() {
  const oferta = useSyncExternalStore(inscrever, lerOferta, nadaNoServidor);
  const [comDica, setComDica] = useState(false);

  if (oferta === "nenhuma") return null;

  const direto = oferta === "instalar-direto";

  return (
    <section
      aria-label="Instalar o app"
      className="border-b border-line bg-panel"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        {/* Quem ouve a tela ouve a dica quando ela entra no lugar da frase. */}
        <p
          aria-live="polite"
          className="min-w-0 flex-1 text-[13px] leading-snug text-ink"
        >
          {comDica && !direto ? (
            <Dica oferta={oferta} />
          ) : (
            <>
              <strong className="font-semibold">
                Instale a Lupa no celular.
              </strong>{" "}
              <span className="text-muted">
                Abre da tela inicial, como um app.
              </span>
            </>
          )}
        </p>
        <Button
          size="sm"
          onClick={() => (direto ? pedirInstalacao() : setComDica(true))}
        >
          <Download size={15} aria-hidden />
          Instalar
        </Button>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Agora não"
          title="Agora não"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </section>
  );
}

/**
 * Um botão do navegador, desenhado como ele aparece na tela. O real não tem
 * texto, então o nome vai só para quem ouve a tela.
 */
function Botao({ icone, nome }: { icone: ReactNode; nome: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-panel-2 px-1 py-0.5 align-middle">
      {icone}
      <span className="sr-only">{nome}</span>
    </span>
  );
}

function Dica({ oferta }: { oferta: Oferta }) {
  if (oferta === "dica-iphone") {
    return (
      <>
        Toque em{" "}
        <Botao icone={<Share size={14} aria-hidden />} nome="Compartilhar" /> e
        depois em{" "}
        <strong className="font-semibold">Adicionar à Tela de Início</strong>.
      </>
    );
  }
  if (oferta === "abrir-no-navegador") {
    return (
      <>
        Abra no navegador: toque em{" "}
        <Botao icone={<Ellipsis size={14} aria-hidden />} nome="Mais" /> e em{" "}
        <strong className="font-semibold">Abrir no navegador</strong>.
      </>
    );
  }
  return (
    <>
      Toque em{" "}
      <Botao
        icone={<EllipsisVertical size={14} aria-hidden />}
        nome="Menu do navegador"
      />{" "}
      e depois em <strong className="font-semibold">Instalar app</strong>.
    </>
  );
}
