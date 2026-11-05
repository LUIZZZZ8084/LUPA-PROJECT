/**
 * Como a vaga de agência diz quem contrata (#538), nos lugares que não são
 * a página da vaga: o card das listas e a arte do story e da prévia.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { dadosDaImagem } from "@/components/brand/imagem-da-vaga";
import { JobCard } from "@/components/job-card";
import { MOCK_JOBS } from "@/lib/mock-data";
import { quemContrata } from "@/lib/vaga-confidencial";

const comum = MOCK_JOBS[0];
const confidencial = { ...comum, hiring_for: "Indústria de alimentos" };

describe("quemContrata", () => {
  it("a vaga comum é a empresa", () => {
    expect(quemContrata(comum)).toBe(comum.company.company_name);
    expect(quemContrata({ ...comum, hiring_for: null })).toBe(
      comum.company.company_name,
    );
  });

  it("a vaga de agência é o cliente, via quem publicou", () => {
    expect(quemContrata(confidencial)).toBe(
      `Indústria de alimentos, via ${comum.company.company_name}`,
    );
  });
});

describe("onde a vaga confidencial aparece", () => {
  it("o card mostra o cliente e a agência, e o via é um pedaço que não se corta", () => {
    const { container } = render(<JobCard job={confidencial} />);
    expect(container.textContent).toContain(
      `Indústria de alimentos, via ${comum.company.company_name}`,
    );
    const via = screen.getByText(`via ${comum.company.company_name}`);
    expect(via.className).toContain("flex-none");
  });

  it("a arte do story e da prévia também", () => {
    expect(dadosDaImagem(confidencial).empresa).toBe(
      `Indústria de alimentos, via ${comum.company.company_name}`,
    );
  });
});
