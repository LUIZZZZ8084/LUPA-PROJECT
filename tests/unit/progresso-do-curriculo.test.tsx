/**
 * A barra de progresso do currículo (#550).
 *
 * A conta é uma só para o aviso do gerador, o perfil e a home: se cada tela
 * contasse do seu jeito, o perfil diria 100% e o gerador avisaria que o
 * currículo sai incompleto.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressoDoPerfil } from "@/components/progresso-do-perfil";
import {
  oQueFaltaNoCurriculoDe,
  progressoDoCurriculo,
} from "@/lib/progresso-do-curriculo";

const VAZIO = {
  areaDesejada: null,
  resumo: null,
  formacao: null,
  disponibilidade: null,
  habilidades: [],
  experiencias: [],
};

const CHEIO = {
  areaDesejada: "Agronegócio",
  resumo: "Operador com 5 anos de safra.",
  formacao: "Ensino médio",
  disponibilidade: "Imediata",
  habilidades: ["Colheitadeira"],
  experiencias: [{ company: "Fazenda", role: "Operador", period: "2020" }],
};

describe("progressoDoCurriculo", () => {
  it("sem nada preenchido é 0%, e faltam as seis partes na ordem do formulário", () => {
    expect(progressoDoCurriculo(VAZIO)).toEqual({
      porcento: 0,
      faltas: [
        "Área desejada",
        "Resumo profissional",
        "Experiências profissionais",
        "Formação",
        "Habilidades",
        "Disponibilidade",
      ],
    });
  });

  it("sem perfil gravado ainda também é 0%", () => {
    expect(progressoDoCurriculo(null).porcento).toBe(0);
    expect(oQueFaltaNoCurriculoDe(null)).toHaveLength(6);
  });

  it("com tudo preenchido é 100% e não falta nada", () => {
    expect(progressoDoCurriculo(CHEIO)).toEqual({ porcento: 100, faltas: [] });
  });

  it("arredonda para baixo: cinco de seis é 83%, nunca 100% antes da hora", () => {
    expect(progressoDoCurriculo({ ...CHEIO, resumo: "" })).toEqual({
      porcento: 83,
      faltas: ["Resumo profissional"],
    });
  });

  it("texto só de espaços conta como vazio", () => {
    expect(oQueFaltaNoCurriculoDe({ ...CHEIO, formacao: "   " })).toEqual([
      "Formação",
    ]);
  });
});

describe("ProgressoDoPerfil", () => {
  it("mostra a porcentagem, a barra, o que falta e o caminho para preencher", () => {
    render(
      <ProgressoDoPerfil porcento={50} faltas={["Resumo profissional"]} />,
    );
    expect(
      screen.getByRole("heading", { name: "Seu currículo está 50% completo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByText("Resumo profissional")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Completar meu perfil" }),
    ).toHaveAttribute("href", "/perfil/editar");
  });

  it("com tudo preenchido não aparece", () => {
    const { container } = render(
      <ProgressoDoPerfil porcento={100} faltas={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
