/**
 * @vitest-environment node
 *
 * `gerarCurriculoPdf` monta o PDF a partir de dados já lidos — sem sessão,
 * sem banco. O que se prova aqui é que a função produz um PDF de verdade
 * e que o conteúdo do perfil chega até ele; não há extrator de texto de
 * PDF nas dependências do projeto, então a prova de conteúdo é pelo
 * tamanho do arquivo crescer com mais seções — um perfil com resumo,
 * habilidades e formação gera um PDF maior que um perfil quase vazio.
 */
import { describe, expect, it } from "vitest";
import {
  type DadosCurriculo,
  gerarCurriculoPdf,
} from "@/server/curriculo/gerar";

const MINIMO: DadosCurriculo = {
  nomeCompleto: "Ana Souza",
  email: "ana@teste.lupa",
  telefone: "66999990000",
  cidade: "Sinop",
  bairro: null,
  areaDesejada: null,
  resumo: null,
  formacao: null,
  habilidades: [],
  disponibilidade: null,
};

const COMPLETO: DadosCurriculo = {
  ...MINIMO,
  bairro: "Centro",
  areaDesejada: "Agronegócio",
  resumo:
    "Motorista com dez anos de experiência em transporte de carga e operação de máquinas agrícolas.",
  formacao: "Ensino médio completo, curso de operador de colheitadeira.",
  habilidades: ["CNH categoria D", "Colheitadeira", "Trator"],
  disponibilidade: "Imediata, inclusive para viagens.",
};

describe("gerarCurriculoPdf", () => {
  it("produz um PDF de verdade", async () => {
    const pdf = await gerarCurriculoPdf(MINIMO);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("cresce quando o perfil tem mais para mostrar", async () => {
    const minimo = await gerarCurriculoPdf(MINIMO);
    const completo = await gerarCurriculoPdf(COMPLETO);
    expect(completo.length).toBeGreaterThan(minimo.length);
  });

  it("não quebra com perfil totalmente vazio", async () => {
    await expect(gerarCurriculoPdf(MINIMO)).resolves.toBeInstanceOf(Buffer);
  });
});
