/**
 * O resultado de uma vaga, na linha dela no painel (#492).
 *
 * O que se prova: os três números juntos, o "muito compatível" que **some**
 * quando não dá para comparar (zero é uma afirmação), e o resumo final de
 * vaga encerrada ou vencida com o caminho para continuar.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultadoDaVagaLinha } from "@/app/(app)/_contratacao/resultado-da-vaga";

const RESULTADO = { visualizacoes: 120, candidaturas: 8, muitoCompativeis: 3 };

describe("ResultadoDaVagaLinha", () => {
  it("mostra visualizações, candidaturas e quantas combinam", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={RESULTADO}
        finalizada={false}
        vagaId="v1"
        base="/empresa"
      />,
    );

    expect(screen.getByText("120 visualizações")).toBeTruthy();
    expect(screen.getByText("8 candidaturas")).toBeTruthy();
    expect(screen.getByText("3 muito compatíveis")).toBeTruthy();
  });

  it("singular quando é um só", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={{ visualizacoes: 1, candidaturas: 1, muitoCompativeis: 1 }}
        finalizada={false}
        vagaId="v1"
        base="/empresa"
      />,
    );

    expect(screen.getByText("1 visualização")).toBeTruthy();
    expect(screen.getByText("1 candidatura")).toBeTruthy();
    expect(screen.getByText("1 muito compatível")).toBeTruthy();
  });

  /**
   * Zero é uma afirmação: "0 muito compatíveis" diz "comparei, e ninguém
   * combina". Quando não deu para comparar, a linha não menciona o número.
   */
  it("não dá para comparar: o número não aparece, em vez de virar zero", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={{ ...RESULTADO, muitoCompativeis: null }}
        finalizada={false}
        vagaId="v1"
        base="/empresa"
      />,
    );

    expect(screen.queryByText(/compatível|compatíveis/)).toBeNull();
    expect(screen.getByText("120 visualizações")).toBeTruthy();
  });

  it("comparou e ninguém combina: o zero aparece, porque é verdade", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={{ ...RESULTADO, muitoCompativeis: 0 }}
        finalizada={false}
        vagaId="v1"
        base="/empresa"
      />,
    );

    expect(screen.getByText("0 muito compatíveis")).toBeTruthy();
  });

  it("vaga no ar não oferece o caminho de publicar outra", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={RESULTADO}
        finalizada={false}
        vagaId="v1"
        base="/empresa"
      />,
    );

    expect(screen.queryByText("Resumo final")).toBeNull();
    expect(
      screen.queryByRole("link", { name: /publicar outra parecida/i }),
    ).toBeNull();
  });

  it("encerrada ou vencida mostra o resumo final e o caminho de publicar outra parecida", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={RESULTADO}
        finalizada
        vagaId="job-abc"
        base="/empresa"
      />,
    );

    expect(screen.getByText("Resumo final")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /publicar outra parecida/i }),
    ).toHaveAttribute("href", "/empresa/vagas/nova?modelo=job-abc");
  });

  it("o caminho acompanha a área de quem contrata", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={RESULTADO}
        finalizada
        vagaId="job-abc"
        base="/contratar"
      />,
    );

    expect(
      screen.getByRole("link", { name: /publicar outra parecida/i }),
    ).toHaveAttribute("href", "/contratar/vagas/nova?modelo=job-abc");
  });

  it("id com caractere especial não quebra o endereço", () => {
    render(
      <ResultadoDaVagaLinha
        resultado={RESULTADO}
        finalizada
        vagaId="a&b=c"
        base="/empresa"
      />,
    );

    expect(
      screen.getByRole("link", { name: /publicar outra parecida/i }),
    ).toHaveAttribute("href", "/empresa/vagas/nova?modelo=a%26b%3Dc");
  });
});
