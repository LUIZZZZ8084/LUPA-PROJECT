"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, type ReactNode, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Cards lado a lado, com encaixe, para escolher entre poucas opções (#503).
 *
 * É rolagem nativa com `scroll-snap`, e não uma biblioteca: o toque, a
 * inércia e o encaixe são do navegador, que faz isso melhor e sem JavaScript
 * para carregar em 3G. O que este componente acrescenta é o que a rolagem
 * sozinha não diz — em que card a pessoa está, e como ir ao próximo com
 * mouse ou teclado.
 *
 * **Os cards têm a mesma altura**, porque o conteúdo de cada um tem tamanho
 * diferente e, sem isso, os botões ficariam em alturas diferentes. Quem
 * desenha o card precisa deixá-lo crescer até o fundo (`h-full`), e o
 * botão vai no fim dele.
 *
 * **Movimento reduzido sai de graça.** A rolagem animada é `scroll-smooth`
 * no contêiner, e a regra global de `prefers-reduced-motion` do app
 * (`globals.css`) a troca por corte seco — por isso o `scrollIntoView` abaixo
 * não pede `behavior: "smooth"`, que passaria por cima dela.
 *
 * **No computador (`lg`) não é carrossel.** As opções cabem na largura e vão
 * numa grade; os pontos e as setas somem, já que não há o que rolar.
 *
 * Os pontos só mostram a posição: não são botões, porque quatro alvos de 44 px
 * numa fileira de pontos não cabem, e o toque já tem o gesto de arrastar. As
 * setas ficam onde há mouse; no celular elas só tomariam espaço.
 */
export function Carrossel({
  rotulo,
  children,
}: {
  /** Nome da região para o leitor de tela, ex.: "Opções de vaga e plano". */
  rotulo: string;
  children: ReactNode;
}) {
  const cartoes = Children.toArray(children);
  const faixa = useRef<HTMLUListElement>(null);
  const [ativo, setAtivo] = useState(0);

  /*
   * O cartão ativo é o que está mais perto do meio da faixa. Num encaixe
   * `center`, é exatamente o que o navegador parou de mostrar inteiro.
   */
  const aoRolar = useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    const meio = el.scrollLeft + el.clientWidth / 2;
    let maisPerto = 0;
    let menor = Number.POSITIVE_INFINITY;
    Array.from(el.children).forEach((filho, i) => {
      const f = filho as HTMLElement;
      const distancia = Math.abs(f.offsetLeft + f.offsetWidth / 2 - meio);
      if (distancia < menor) {
        menor = distancia;
        maisPerto = i;
      }
    });
    setAtivo(maisPerto);
  }, []);

  function irPara(indice: number) {
    const el = faixa.current;
    const alvo = Math.min(Math.max(indice, 0), cartoes.length - 1);
    // Atualiza já, sem esperar o evento de rolagem: com movimento reduzido ou
    // num teste, a rolagem acontece num quadro só.
    setAtivo(alvo);
    el?.children[alvo]?.scrollIntoView({ inline: "center", block: "nearest" });
  }

  return (
    <div>
      {/*
        `tabIndex={0}` é o que deixa o teclado rolar a faixa: setas
        esquerda e direita mexem nela quando ela tem foco. Sem isso, quem não
        usa mouse só chegaria aos cards que têm botão.
      */}
      <ul
        ref={faixa}
        onScroll={aoRolar}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: faixa que rola precisa de foco para o teclado
        tabIndex={0}
        aria-label={rotulo}
        className={cn(
          // `relative` faz da faixa o `offsetParent` dos cards: sem ele, o
          // `offsetLeft` de cada um é medido a partir de um ancestral lá fora,
          // e o ponto aceso erra por quanto a faixa está longe da borda.
          "relative flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto scroll-smooth",
          // Sem barra: as setas e os pontos já dizem que há mais, e a barra
          // do navegador desenha um trilho por cima dos cards.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Um cartão em foco e a borda do vizinho à vista, para a pessoa
          // ver que há mais sem ninguém avisar.
          "-mx-1 px-1 pb-1",
          // No computador (#525) cabem todas as opções: a faixa vira grade e
          // não há o que rolar.
          "lg:grid lg:snap-none lg:grid-cols-2 lg:overflow-visible xl:grid-cols-4",
        )}
      >
        {cartoes.map((cartao, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: a lista é fixa e na mesma ordem
            key={i}
            className="flex-none basis-[85%] snap-center sm:basis-[60%] lg:basis-auto"
          >
            {cartao}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => irPara(ativo - 1)}
          disabled={ativo === 0}
          aria-label="Opção anterior"
          className="hidden h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-empresas hover:text-empresas disabled:pointer-events-none disabled:text-faint sm:flex"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2" aria-hidden>
          {cartoes.map((_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a lista é fixa e na mesma ordem
              key={i}
              data-ativo={i === ativo}
              className={cn(
                "h-2 rounded-full transition-all",
                i === ativo ? "w-5 bg-empresas" : "w-2 bg-line",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => irPara(ativo + 1)}
          disabled={ativo === cartoes.length - 1}
          aria-label="Próxima opção"
          className="hidden h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-empresas hover:text-empresas disabled:pointer-events-none disabled:text-faint sm:flex"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
