/**
 * O contador de vagas para publicar (#518).
 *
 * A conta precisa bater com o que `gastarParaPublicar` deixaria publicar:
 * as três fontes somadas, na ordem em que são gastas. O caso que mais
 * importa é o plano cheio com saldo guardado — mostrar "0" ali mandaria a
 * empresa comprar o que ela já tem.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContadorDeVagas } from "@/app/(app)/_contratacao/contador-de-vagas";
import { type DireitoParaTela, vagasParaPublicar } from "@/lib/planos-empresa";

const direito = (parcial: Partial<DireitoParaTela> = {}): DireitoParaTela => ({
  pode: false,
  mensalAtivo: false,
  limiteNoAr: null,
  noAr: 0,
  planoCheio: false,
  creditos: 0,
  primeiraGratis: false,
  ...parcial,
});

const comPlano = (limite: number, noAr: number, resto = {}) =>
  direito({
    mensalAtivo: true,
    limiteNoAr: limite,
    noAr,
    planoCheio: noAr >= limite,
    ...resto,
  });

describe("vagasParaPublicar", () => {
  it("sem plano, sem saldo e sem a grátis, é zero", () => {
    expect(vagasParaPublicar(direito()).total).toBe(0);
  });

  it("soma o lugar no plano, as avulsas e a primeira grátis", () => {
    expect(
      vagasParaPublicar(comPlano(5, 2, { creditos: 2, primeiraGratis: true })),
    ).toEqual({ total: 6, doPlano: 3, avulsas: 2, gratis: 1 });
  });

  it("plano cheio com saldo ainda publica, pelo saldo", () => {
    const vagas = vagasParaPublicar(comPlano(5, 5, { creditos: 1 }));
    expect(vagas.total).toBe(1);
    expect(vagas.doPlano).toBe(0);
  });

  it("nunca fica negativo quando há mais vagas no ar que o limite", () => {
    // Trocar do Plano 10 para o 5 com oito no ar: as oito continuam.
    expect(vagasParaPublicar(comPlano(5, 8)).total).toBe(0);
  });

  it("o plano ilimitado não se conta", () => {
    expect(
      vagasParaPublicar(direito({ mensalAtivo: true, creditos: 3 })).total,
    ).toBeNull();
  });

  it("plano vencido não conta lugar nenhum, só o saldo", () => {
    // `direitoDePublicar` devolve o limite como null quando o plano venceu.
    expect(vagasParaPublicar(direito({ creditos: 2 }))).toEqual({
      total: 2,
      doPlano: null,
      avulsas: 2,
      gratis: 0,
    });
  });
});

describe("ContadorDeVagas", () => {
  const numero = () =>
    screen.getByRole("heading", { name: "Vagas para publicar" })
      .nextElementSibling?.textContent;

  it("mostra o total, de onde vem e quantas estão no ar no plano", () => {
    render(
      <ContadorDeVagas
        direito={comPlano(5, 2, { creditos: 1 })}
        base="/empresa"
      />,
    );

    expect(numero()).toBe("4");
    const origens = screen.getByRole("list", { name: "De onde vêm" });
    expect(origens.textContent).toContain("3 do plano");
    expect(origens.textContent).toContain("1 avulsa");
    expect(screen.getByText("2 de 5")).toBeTruthy();
    // Com vaga para publicar, o contador só informa.
    expect(screen.queryByRole("link", { name: "Ver planos" })).toBeNull();
  });

  it("no ilimitado diz 'Ilimitado', sem barra de uso", () => {
    render(
      <ContadorDeVagas
        direito={direito({ mensalAtivo: true, pode: true })}
        base="/empresa"
      />,
    );

    expect(numero()).toBe("Ilimitado");
    expect(screen.queryByText("No ar agora")).toBeNull();
  });

  it("zerado, diz o que fazer e leva aos planos da porta certa", () => {
    render(<ContadorDeVagas direito={direito()} base="/contratar" />);

    expect(numero()).toBe("0");
    expect(screen.getByText(/Suas vagas acabaram/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ver planos" }).getAttribute("href"),
    ).toBe("/contratar/creditos");
  });

  it("com o plano cheio, a frase fala do plano", () => {
    render(<ContadorDeVagas direito={comPlano(5, 5)} base="/empresa" />);

    expect(screen.getByText(/Seu plano está cheio/)).toBeTruthy();
  });

  it("na própria tela de planos não repete o link para ela", () => {
    render(
      <ContadorDeVagas
        direito={direito()}
        base="/empresa"
        linkParaPlanos={false}
      />,
    );

    expect(screen.queryByRole("link", { name: "Ver planos" })).toBeNull();
  });
});
