/**
 * O carrossel das opções de plano (#503).
 *
 * A rolagem e o encaixe são do navegador, e o que se prova aqui é o que o
 * componente acrescenta: a faixa é uma lista rotulada e focável (sem isso o
 * teclado não rola), os pontos dizem em que card a pessoa está, e as setas
 * levam ao vizinho sem passar do primeiro nem do último.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Carrossel } from "@/components/carrossel";

const rolar = vi.fn();

beforeEach(() => {
  rolar.mockReset();
  // O jsdom não implementa `scrollIntoView`.
  Element.prototype.scrollIntoView = rolar;
});

function montar() {
  render(
    <Carrossel rotulo="Opções de vaga e plano">
      <div>Um</div>
      <div>Dois</div>
      <div>Três</div>
    </Carrossel>,
  );
}

const pontos = () =>
  [...document.querySelectorAll("[data-ativo]")].map(
    (p) => p.getAttribute("data-ativo") === "true",
  );

describe("carrossel", () => {
  it("é uma lista rotulada com um item por card", () => {
    montar();

    const lista = screen.getByRole("list", { name: "Opções de vaga e plano" });
    expect(lista.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(screen.getByText("Dois")).toBeTruthy();
  });

  /** Sem foco na faixa, quem não usa mouse só alcançaria cards com botão. */
  it("a faixa recebe foco, para o teclado rolar", () => {
    montar();

    expect(
      screen
        .getByRole("list", { name: "Opções de vaga e plano" })
        .getAttribute("tabindex"),
    ).toBe("0");
  });

  it("começa no primeiro card, e a seta de voltar está desligada", () => {
    montar();

    expect(pontos()).toEqual([true, false, false]);
    expect(
      screen.getByRole("button", { name: "Opção anterior" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Próxima opção" }),
    ).toHaveProperty("disabled", false);
  });

  it("a seta leva ao vizinho, rola até ele e acende o ponto dele", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Próxima opção" }));

    expect(pontos()).toEqual([false, true, false]);
    expect(rolar).toHaveBeenCalledTimes(1);
    expect(rolar.mock.instances[0]).toBe(
      screen.getByText("Dois").parentElement,
    );
    // Sem `behavior`: quem prefere menos movimento tem a rolagem animada
    // trocada por corte seco pela regra global do CSS, e `smooth` aqui
    // passaria por cima dela.
    expect(rolar).toHaveBeenCalledWith({ inline: "center", block: "nearest" });
    expect(
      screen.getByRole("button", { name: "Opção anterior" }),
    ).toHaveProperty("disabled", false);
  });

  it("no último card a seta de avançar desliga, e não passa do fim", () => {
    montar();
    const proxima = screen.getByRole("button", { name: "Próxima opção" });

    fireEvent.click(proxima);
    fireEvent.click(proxima);

    expect(pontos()).toEqual([false, false, true]);
    expect(proxima).toHaveProperty("disabled", true);
  });

  /**
   * O gesto de arrastar não passa pelas setas: quem diz o card ativo é a
   * posição da rolagem — o que está mais perto do meio da faixa.
   */
  it("a rolagem muda o ponto aceso para o card mais perto do meio", () => {
    montar();
    const faixa = screen.getByRole("list", { name: "Opções de vaga e plano" });
    const itens = [...faixa.querySelectorAll(":scope > li")] as HTMLElement[];

    Object.defineProperty(faixa, "clientWidth", { value: 300 });
    itens.forEach((item, i) => {
      Object.defineProperty(item, "offsetLeft", { value: i * 260 });
      Object.defineProperty(item, "offsetWidth", { value: 250 });
    });

    // Meio da faixa em 520 + 150 = 670; o centro do terceiro card é 645.
    faixa.scrollLeft = 520;
    fireEvent.scroll(faixa);

    expect(pontos()).toEqual([false, false, true]);
  });

  it("os pontos não entram na leitura de tela: só repetiriam a lista", () => {
    montar();

    expect(
      document
        .querySelector("[data-ativo]")
        ?.parentElement?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
