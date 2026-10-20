"use client";

import {
  Download,
  Ellipsis,
  EllipsisVertical,
  Share,
  SquarePlus,
  X,
} from "lucide-react";
import { type ReactNode, useId, useState, useSyncExternalStore } from "react";
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
 * casos, mostra os passos daquele aparelho. A regra de quem vê o quê mora
 * em `src/lib/instalacao.ts`.
 */
export function InstalarApp() {
  const oferta = useSyncExternalStore(inscrever, lerOferta, nadaNoServidor);
  const [aberto, setAberto] = useState(false);
  const idPassos = useId();

  if (oferta === "nenhuma") return null;

  const direto = oferta === "instalar-direto";

  return (
    <section
      aria-label="Instalar o app"
      className="border-b border-line bg-panel"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
          <strong className="font-semibold">Instale a Lupa no celular.</strong>{" "}
          <span className="text-muted">Abre da tela inicial, como um app.</span>
        </p>
        <Button
          size="sm"
          onClick={() => (direto ? pedirInstalacao() : setAberto((a) => !a))}
          aria-expanded={direto ? undefined : aberto}
          aria-controls={direto ? undefined : idPassos}
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
      {!direto && (
        <div
          id={idPassos}
          hidden={!aberto}
          className="mx-auto max-w-6xl px-4 pb-3 sm:px-6"
        >
          <Passos oferta={oferta} />
        </div>
      )}
    </section>
  );
}

/** Um botão do navegador, desenhado como ele aparece na tela. */
function Botao({
  icone,
  nome,
  children,
}: {
  icone: ReactNode;
  /** Para quem ouve a tela, quando o botão real não tem texto. */
  nome?: string;
  children?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-0.5 align-middle font-semibold">
      {icone}
      {children}
      {nome && <span className="sr-only">{nome}</span>}
    </span>
  );
}

function Lista({ children }: { children: ReactNode }) {
  return (
    <ol className="list-decimal space-y-2 rounded-xl border border-line bg-panel-2 py-3 pr-3 pl-8 text-[13px] leading-relaxed text-ink">
      {children}
    </ol>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs leading-relaxed text-muted">{children}</p>;
}

function Passos({ oferta }: { oferta: Oferta }) {
  if (oferta === "passos-iphone") {
    return (
      <>
        <Lista>
          <li>
            Toque em{" "}
            <Botao icone={<Share size={14} aria-hidden />}>Compartilhar</Botao>{" "}
            — no Safari, fica na barra de baixo; no Chrome, ao lado do endereço.
            Se não achar, toque antes em{" "}
            <Botao icone={<Ellipsis size={14} aria-hidden />} nome="Mais" />
          </li>
          <li>
            Role a lista e toque em{" "}
            <Botao icone={<SquarePlus size={14} aria-hidden />}>
              Adicionar à Tela de Início
            </Botao>
          </li>
          <li>
            Toque em <strong>Adicionar</strong>. A Lupa fica na tela inicial,
            como um app.
          </li>
        </Lista>
        <Nota>
          Não achou a opção? Abra este endereço direto no Safari e tente de
          novo.
        </Nota>
      </>
    );
  }

  if (oferta === "abrir-no-navegador") {
    return (
      <>
        <Nota>
          O Instagram e o Facebook não deixam instalar por dentro deles. Abra a
          Lupa no navegador primeiro:
        </Nota>
        <div className="mt-2">
          <Lista>
            <li>
              No canto de cima, toque nos três pontinhos{" "}
              <Botao icone={<Ellipsis size={14} aria-hidden />} nome="Mais" />
            </li>
            <li>
              Escolha <strong>Abrir no navegador</strong> — ou{" "}
              <strong>Abrir no Safari</strong>, ou <strong>no Chrome</strong>.
            </li>
            <li>
              Lá, toque em <strong>Instalar</strong> de novo.
            </li>
          </Lista>
        </div>
      </>
    );
  }

  return (
    <>
      <Lista>
        <li>
          No canto de cima, toque no menu do navegador{" "}
          <Botao
            icone={<EllipsisVertical size={14} aria-hidden />}
            nome="três pontinhos"
          />
        </li>
        <li>
          Toque em{" "}
          <Botao icone={<Download size={14} aria-hidden />}>Instalar app</Botao>{" "}
          ou em <strong>Adicionar à tela inicial</strong>.
        </li>
        <li>
          Confirme em <strong>Instalar</strong>. A Lupa fica na tela inicial,
          como um app.
        </li>
      </Lista>
      <Nota>
        Se o menu não tiver essa opção, escolha antes{" "}
        <strong>Abrir no Chrome</strong>.
      </Nota>
    </>
  );
}
