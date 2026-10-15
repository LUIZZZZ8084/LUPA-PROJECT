/**
 * Os blocos novos do painel do admin, renderizados (#471).
 *
 * A conta de cada número tem teste no serviço, no repositório e num
 * Postgres de verdade (`schema.test.ts`). O que se testa aqui é o que
 * quebra na tela: o estado vazio, a frase que o leitor de tela lê no lugar
 * das barras, a porcentagem sobre a base certa e a ordem em que a receita
 * cobre os custos.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoberturaDosCustos } from "@/app/(app)/admin/painel/cobertura-dos-custos";
import {
  ContasPorLugarBlocos,
  descrever,
} from "@/app/(app)/admin/painel/contas-por-lugar";
import { FunilDoPainel, porcentagem } from "@/app/(app)/admin/painel/funil";
import type { Funil } from "@/server/metrics/tipos";

const CUSTOS = [
  { nome: "Supabase Pro", centavos: 13_300 },
  { nome: "Vercel Pro", centavos: 10_700 },
];

function receita(recorrente: number, entrou = 0): Funil["receita"] {
  return {
    assinaturasAtivas: recorrente > 0 ? 2 : 0,
    recorrenteAtivoCentavos: recorrente,
    entrouUltimos30DiasCentavos: entrou,
  };
}

describe("contas por lugar", () => {
  it("mostra cada estado e cada cidade com os três papéis", () => {
    render(
      <ContasPorLugarBlocos
        lugares={{
          estados: [
            {
              lugar: "MT",
              candidatos: 4,
              prestadores: 1,
              empresas: 2,
              total: 7,
            },
          ],
          cidades: [
            {
              lugar: "Sinop - MT",
              candidatos: 3,
              prestadores: 1,
              empresas: 0,
              total: 4,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("MT")).toBeInTheDocument();
    expect(screen.getByText("Sinop - MT")).toBeInTheDocument();
    // O leitor de tela lê a frase, não as barras.
    expect(
      screen.getByText(/4 candidatos, 1 prestador, 2 empresas/),
    ).toBeInTheDocument();
  });

  it("sem conta nenhuma, diz isso nos dois blocos", () => {
    render(<ContasPorLugarBlocos lugares={{ estados: [], cidades: [] }} />);
    expect(screen.getAllByText("Ainda sem contas.")).toHaveLength(2);
  });

  it("a frase usa singular e plural certos", () => {
    expect(
      descrever({
        lugar: "x",
        candidatos: 1,
        prestadores: 0,
        empresas: 2,
        total: 3,
      }),
    ).toBe("1 candidato, 0 prestadores, 2 empresas");
  });
});

describe("funil", () => {
  /*
   * A porcentagem é sobre o primeiro passo da coluna, nunca sobre o
   * anterior: "20% das empresas compraram" se lê sem conta.
   */
  it("a porcentagem de cada passo é sobre a primeira linha da coluna", () => {
    render(
      <FunilDoPainel
        funil={{
          candidatos: 10,
          candidatosVisiveis: 4,
          candidatosQueSeCandidataram: 2,
          prestadores: 0,
          prestadoresNaVitrine: 0,
          prestadoresAssinantes: 0,
          empresas: 5,
          empresasVerificadas: 4,
          empresasComVaga: 2,
          empresasQueCompraram: 1,
          receita: receita(0),
        }}
      />,
    );

    const passo = (coluna: string, rotulo: string) =>
      within(
        within(screen.getByRole("region", { name: coluna }))
          .getByText(rotulo)
          .closest("li") as HTMLElement,
      );

    // 1 de 5 empresas compraram: 20%, e não 50% das 2 que publicaram.
    expect(passo("Empresas", "Compraram vaga").getByText("1")).toBeVisible();
    expect(passo("Empresas", "Compraram vaga").getByText("20%")).toBeVisible();
    // 2 de 10 candidatos: 20%, e não 50% dos 4 visíveis.
    expect(
      passo("Candidatos", "Já se candidataram").getByText("20%"),
    ).toBeVisible();
    expect(passo("Candidatos", "Com conta").getByText("100%")).toBeVisible();
  });

  it("sem base para dividir, é um traço e não NaN", () => {
    expect(porcentagem(0, 0)).toBe("—");
    expect(porcentagem(3, 4)).toBe("75%");
  });
});

describe("o Lupa já se paga?", () => {
  it("sem receita recorrente, falta o custo inteiro, e diz quanto", () => {
    render(<CoberturaDosCustos receita={receita(0)} custos={CUSTOS} />);

    expect(screen.getByText(/0 assinaturas ativas/)).toBeInTheDocument();
    expect(screen.getByText("faltam R$ 133")).toBeInTheDocument();
    expect(screen.getByText("faltam R$ 107")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  /*
   * A pergunta era "pelo menos o Supabase": a receita cobre o primeiro
   * custo antes do segundo.
   */
  it("a receita cobre o Supabase primeiro, e o que sobra vai para o Vercel", () => {
    render(<CoberturaDosCustos receita={receita(15_000)} custos={CUSTOS} />);

    const supabase = screen.getByText(/Supabase Pro/).closest("li");
    const vercel = screen.getByText(/Vercel Pro/).closest("li");
    expect(supabase).toHaveTextContent("coberto");
    // 150,00 − 133,00 sobram 17,00; faltam 90,00 dos 107,00.
    expect(vercel).toHaveTextContent("faltam R$ 90");
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("diz que o valor é bruto, e mostra o que entrou em 30 dias à parte", () => {
    render(<CoberturaDosCustos receita={receita(0, 9_990)} custos={CUSTOS} />);

    expect(screen.getByText("R$ 100")).toBeInTheDocument();
    expect(screen.getByText(/Valores brutos/)).toBeInTheDocument();
  });
});
