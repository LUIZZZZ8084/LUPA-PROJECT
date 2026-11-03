/**
 * @vitest-environment node
 *
 * `gerarCurriculoPdf` monta o PDF a partir de dados já lidos — sem sessão,
 * sem banco.
 *
 * O modelo (#531) é testado por `secoesDoCurriculo`, que decide o que entra
 * e em que ordem: não há extrator de texto de PDF nas dependências do
 * projeto, e conferir a ordem pelo tamanho do arquivo não diria nada. O
 * resto prova que o PDF é de verdade e que cresce com o conteúdo.
 */
import { describe, expect, it } from "vitest";
import { CURRICULO_DE_EXEMPLO } from "@/server/curriculo/exemplo";
import {
  type DadosCurriculo,
  gerarCurriculoPdf,
  secoesDoCurriculo,
} from "@/server/curriculo/gerar";

const MINIMO: DadosCurriculo = {
  nomeCompleto: "Ana Souza",
  email: "ana@teste.lupa",
  telefone: "66999990000",
  cidade: "Sinop - MT",
  areaDesejada: null,
  resumo: null,
  formacao: null,
  habilidades: [],
  experiencias: [],
  disponibilidade: null,
};

const titulos = (dados: DadosCurriculo) =>
  secoesDoCurriculo(dados).map((s) => s.titulo);

describe("secoesDoCurriculo", () => {
  it("segue a ordem do modelo, com a experiência antes da formação", () => {
    expect(titulos(CURRICULO_DE_EXEMPLO)).toEqual([
      "Objetivo",
      "Resumo profissional",
      "Experiência profissional",
      "Formação",
      "Habilidades",
      "Disponibilidade",
    ]);
  });

  it("seção vazia não entra — nem a que só tem espaço em branco", () => {
    expect(titulos(MINIMO)).toEqual([]);
    expect(
      titulos({
        ...MINIMO,
        resumo: "   ",
        formacao: "",
        habilidades: ["  "],
        experiencias: [{ role: " ", company: "", period: "2020" }],
      }),
    ).toEqual([]);
  });

  it("as experiências entram inteiras, sem espaço sobrando", () => {
    const secao = secoesDoCurriculo({
      ...MINIMO,
      experiencias: [
        {
          role: " Motorista ",
          company: "Transportes Nortão",
          period: " 2019 – 2023 ",
          description: " Carga seca para Cuiabá. ",
        },
        { role: "", company: "Fazenda Boa Vista", period: "" },
      ],
    })[0];

    expect(secao).toEqual({
      titulo: "Experiência profissional",
      tipo: "experiencias",
      itens: [
        {
          role: "Motorista",
          company: "Transportes Nortão",
          period: "2019 – 2023",
          description: "Carga seca para Cuiabá.",
        },
        // Só a empresa, sem cargo, ainda é uma experiência.
        {
          role: "",
          company: "Fazenda Boa Vista",
          period: "",
          description: undefined,
        },
      ],
    });
  });

  it("o objetivo diz a área, em frase", () => {
    expect(
      secoesDoCurriculo({ ...MINIMO, areaDesejada: "Agronegócio" })[0],
    ).toEqual({
      titulo: "Objetivo",
      tipo: "texto",
      texto: "Atuar na área de Agronegócio.",
    });
  });
});

describe("gerarCurriculoPdf", () => {
  it("produz um PDF de verdade, mesmo com o perfil vazio", async () => {
    const pdf = await gerarCurriculoPdf(MINIMO);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("cresce quando o perfil tem mais para mostrar", async () => {
    const minimo = await gerarCurriculoPdf(MINIMO);
    const completo = await gerarCurriculoPdf(CURRICULO_DE_EXEMPLO);
    expect(completo.length).toBeGreaterThan(minimo.length);
  });

  it("aguenta um currículo longo, de mais de uma página", async () => {
    const longo = await gerarCurriculoPdf({
      ...CURRICULO_DE_EXEMPLO,
      experiencias: Array.from(
        { length: 5 },
        () => CURRICULO_DE_EXEMPLO.experiencias,
      ).flat(),
    });
    // O dicionário de cada página vira um `/Type /Page` no arquivo.
    const paginas = longo.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(paginas.length).toBeGreaterThan(1);
  });
});
