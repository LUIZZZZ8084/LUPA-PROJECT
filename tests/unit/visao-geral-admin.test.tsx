/**
 * A visão geral do painel do admin (#507).
 *
 * As contas são puras e testadas sem desenhar nada; a tela é desenhada no
 * jsdom, porque a suíte e2e não tem sessão de admin. O que se protege é o
 * número que mente: "100%" sem custo cadastrado, variação contra uma semana
 * sem cadastro, ou um mapa que mistura os papéis.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisaoGeral } from "@/app/(app)/admin/painel/visao-geral";
import {
  dividirEmRetangulos,
  estadosDoPapel,
  fracaoCoberta,
  maioresVazamentos,
  passosDoFunil,
  regiaoDaUf,
  ritmoDeCadastros,
} from "@/app/(app)/admin/painel/visao-geral-dados";
import type {
  CadastrosPorDia,
  Funil,
  PainelAdmin,
} from "@/server/metrics/tipos";

function dias(totais: number[]): CadastrosPorDia[] {
  return totais.map((total, i) => ({
    dia: `2026-10-${String(i + 1).padStart(2, "0")}`,
    total,
    porPapel: {
      candidato_clt: total,
      prestador_servico: 0,
      empresa: 0,
      admin: 0,
    },
  }));
}

const FUNIL: Funil = {
  candidatos: 20,
  candidatosVisiveis: 10,
  candidatosQueSeCandidataram: 15,
  prestadores: 5,
  prestadoresNaVitrine: 4,
  prestadoresAssinantes: 1,
  empresas: 4,
  empresasVerificadas: 3,
  empresasComVaga: 2,
  empresasQueCompraram: 0,
  receita: {
    assinaturasAtivas: 2,
    recorrenteAtivoCentavos: 11_980,
    entrouUltimos30DiasCentavos: 4_990,
  },
};

const PAINEL: PainelAdmin = {
  totais: {
    usuarios: 29,
    candidatos: 20,
    prestadores: 5,
    empresas: 4,
    vagasAbertas: 3,
  },
  cadastros: dias([0, 1, 2, 0, 1, 3, 2, 1, 0, 0, 1, 2, 1, 1]),
  lugares: {
    estados: [
      { lugar: "MT", candidatos: 15, prestadores: 4, empresas: 3, total: 22 },
      { lugar: "SP", candidatos: 4, prestadores: 0, empresas: 1, total: 5 },
      { lugar: "PR", candidatos: 1, prestadores: 1, empresas: 0, total: 2 },
    ],
    cidades: [],
  },
  funil: FUNIL,
  custos: [{ id: "c1", nome: "Supabase Pro", centavos: 13_300 }],
  caixa: {
    entrouCentavos: 0,
    estornadoCentavos: 0,
    contestadoCentavos: 0,
    recorrenteCentavos: 0,
    liquidoCentavos: 0,
    cobrancas: 0,
    contestacoes: 0,
  },
  pressao: [],
  apuradoEm: "2026-10-27T12:00:00.000Z",
};

describe("contas da visão geral", () => {
  it("cobertura: fração de 0 a 1, e nula sem custo cadastrado", () => {
    expect(fracaoCoberta(5_000, 10_000)).toBe(0.5);
    expect(fracaoCoberta(30_000, 10_000)).toBe(1);
    expect(fracaoCoberta(5_000, 0)).toBeNull();
  });

  it("ritmo: a última semana contra a anterior", () => {
    const r = ritmoDeCadastros(
      dias([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]),
    );
    expect(r).toEqual({ ultimos7: 14, anteriores7: 7, variacao: 1 });
  });

  it("ritmo: sem cadastro na semana anterior, não há variação", () => {
    expect(
      ritmoDeCadastros(dias([0, 0, 0, 0, 0, 0, 0, 3])).variacao,
    ).toBeNull();
  });

  it("cada estado na região do IBGE certa", () => {
    expect(regiaoDaUf("MT")).toBe("Centro-Oeste");
    expect(regiaoDaUf("BA")).toBe("Nordeste");
    expect(regiaoDaUf("RS")).toBe("Sul");
    expect(regiaoDaUf("Sem estado")).toBe("Sem estado");
  });

  it("o mapa de um papel só leva os estados com conta nele, do maior para o menor", () => {
    expect(estadosDoPapel(PAINEL.lugares.estados, "prestadores")).toEqual([
      { uf: "MT", contas: 4, regiao: "Centro-Oeste" },
      { uf: "PR", contas: 1, regiao: "Sul" },
    ]);
  });

  it("os retângulos cobrem a área inteira, cada um do tamanho das contas", () => {
    const r = dividirEmRetangulos(
      [
        { item: "a", valor: 6 },
        { item: "b", valor: 3 },
        { item: "c", valor: 1 },
      ],
      100,
      100,
    );
    const area = (x: { w: number; h: number }) => x.w * x.h;
    expect(r.reduce((s, x) => s + area(x), 0)).toBeCloseTo(10_000);
    expect(area(r[0])).toBeCloseTo(6_000);
    expect(area(r[2])).toBeCloseTo(1_000);
  });

  it("os passos do funil são fração de quem tem conta no papel", () => {
    const passos = passosDoFunil(FUNIL);
    expect(passos).toHaveLength(7);
    expect(passos.find((p) => p.rotulo === "Visíveis")?.fracao).toBe(0.5);
    expect(passos.find((p) => p.rotulo === "Compraram")?.fracao).toBe(0);
  });

  it("papel sem ninguém não entra nos vazamentos", () => {
    const passos = passosDoFunil({ ...FUNIL, prestadores: 0 });
    expect(
      maioresVazamentos(passos, 10).some((p) => p.papel === "prestadores"),
    ).toBe(false);
    expect(maioresVazamentos(passos)[0].rotulo).toBe("Compraram");
  });
});

describe("tela da visão geral", () => {
  it("mostra os quatro cards, com a receita e o quanto ela cobre", () => {
    render(<VisaoGeral painel={PAINEL} />);

    for (const titulo of [
      "Receita que se repete",
      "Contas",
      "Onde estão as contas",
      "Onde o funil vaza",
    ]) {
      expect(screen.getByRole("region", { name: titulo })).toBeTruthy();
    }
    expect(
      screen.getByRole("img", { name: /cobre 90% do custo do mês/i }),
    ).toBeTruthy();
    expect(screen.getByText(/faltam/i)).toBeTruthy();
  });

  /**
   * O medidor e o bloco "O Lupa já se paga?" respondem a mesma pergunta na
   * mesma tela (#523): R$ 179,80 contra R$ 240,00 é 74%, e faltam R$ 60,20 —
   * não 75% e "R$ 60".
   */
  it("o medidor trunca e diz o que falta com centavos, como o bloco de custos", () => {
    render(
      <VisaoGeral
        painel={{
          ...PAINEL,
          funil: {
            ...PAINEL.funil,
            receita: {
              ...PAINEL.funil.receita,
              recorrenteAtivoCentavos: 17_980,
            },
          },
          custos: [{ ...PAINEL.custos[0], centavos: 24_000 }],
        }}
      />,
    );

    expect(
      screen.getByRole("img", { name: /cobre 74% do custo do mês/i }),
    ).toBeTruthy();
    expect(screen.getByText(/Faltam R\$\s?60,20 por mês/)).toBeTruthy();
  });

  it("sem custo cadastrado, o medidor não inventa porcentagem", () => {
    render(<VisaoGeral painel={{ ...PAINEL, custos: [] }} />);

    expect(
      screen.getByRole("img", { name: /sem custo cadastrado/i }),
    ).toBeTruthy();
    expect(screen.getByText(/cadastre os custos/i)).toBeTruthy();
  });

  it("o mapa troca de papel e diz quais estados entram", () => {
    render(<VisaoGeral painel={PAINEL} />);
    const mapa = screen.getByRole("region", { name: "Onde estão as contas" });

    expect(
      within(mapa).getByRole("img", { name: /MT 22, SP 5, PR 2/ }),
    ).toBeTruthy();

    fireEvent.click(within(mapa).getByRole("button", { name: "Empresas" }));
    expect(
      within(mapa).getByRole("button", { name: "Empresas" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(mapa).getByRole("img", { name: /MT 3, SP 1$/ })).toBeTruthy();
  });

  it("papel sem conta nenhuma diz isso, em vez de um mapa vazio", () => {
    render(
      <VisaoGeral
        painel={{
          ...PAINEL,
          lugares: {
            estados: [
              {
                lugar: "MT",
                candidatos: 1,
                prestadores: 0,
                empresas: 0,
                total: 1,
              },
            ],
            cidades: [],
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Prestadores" }));

    expect(screen.getByText(/nenhuma conta neste papel/i)).toBeTruthy();
  });

  it("o radar descreve cada passo, e os maiores vazamentos vêm escritos", () => {
    render(<VisaoGeral painel={PAINEL} />);
    const funil = screen.getByRole("region", { name: "Onde o funil vaza" });

    expect(
      within(funil).getByRole("img", { name: /compraram 0%/i }),
    ).toBeTruthy();
    expect(within(funil).getByText("0")).toBeTruthy();
    expect(within(funil).getByText(/de 4/)).toBeTruthy();
  });

  it("o ritmo da semana aparece com a variação", () => {
    render(<VisaoGeral painel={PAINEL} />);
    expect(screen.getByText(/nos últimos 7 dias/i)).toBeTruthy();
  });
});
