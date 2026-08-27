/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  schemaEdicaoVaga,
  schemaIdVaga,
  schemaNovaVaga,
} from "@/server/vagas/schemas";

const DADOS = {
  titulo: "Auxiliar Administrativo",
  descricao: "Rotina de recepção, arquivo e atendimento telefônico.",
  categoria: "Administrativo",
  cidade: "Sinop",
  tipoContrato: "CLT",
  endereco: "Av. das Itaúbas, 1200",
};

describe("schemaNovaVaga", () => {
  it("aceita o mínimo", () => {
    const r = schemaNovaVaga.safeParse(DADOS);
    expect(r.success).toBe(true);
  });

  it("bairro em branco vira 'não informado', não erro", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, bairro: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.bairro).toBeUndefined();
  });

  /*
   * O bairro deixou de ser enum quando o app abriu para Mato Grosso
   * inteiro: não existe lista de bairros de 142 municípios, e enum
   * recusaria bairro novo até em Sinop. O que o servidor ainda garante é
   * tamanho — bairro de uma letra é engano de digitação, não bairro.
   */
  it("aceita bairro fora da lista curada", () => {
    const r = schemaNovaVaga.safeParse({
      ...DADOS,
      cidade: "Sorriso",
      bairro: "Jardim Itália",
    });
    expect(r.success).toBe(true);
  });

  it("recusa bairro curto demais", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, bairro: "X" });
    expect(r.success).toBe(false);
  });

  it("recusa cidade fora de Mato Grosso", () => {
    for (const cidade of ["Curitiba", "sinop", "Sinop - MT", ""]) {
      const r = schemaNovaVaga.safeParse({ ...DADOS, cidade });
      expect(r.success, cidade || "(vazio)").toBe(false);
    }
  });

  it("aceita qualquer município de MT, não só o inicial", () => {
    for (const cidade of ["Cuiabá", "Sorriso", "Alta Floresta", "Vera"]) {
      const r = schemaNovaVaga.safeParse({ ...DADOS, cidade });
      expect(r.success, cidade).toBe(true);
    }
  });

  it("recusa cargo curto demais", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, titulo: "Ok" });
    expect(r.success).toBe(false);
  });

  it("recusa descrição curta demais", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, descricao: "curta" });
    expect(r.success).toBe(false);
  });

  it("recusa sem categoria", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, categoria: "" });
    expect(r.success).toBe(false);
  });

  /*
   * Aditivo ao bairro, não substituto — mas obrigatório, ao contrário
   * dele: é o que diz onde a vaga é de verdade para quem já decidiu se
   * candidatar.
   */
  it("recusa sem endereço", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, endereco: "" });
    expect(r.success).toBe(false);
  });

  it("recusa endereço curto demais", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, endereco: "Rua" });
    expect(r.success).toBe(false);
  });

  it("recusa teto de salário menor que o piso", () => {
    const r = schemaNovaVaga.safeParse({
      ...DADOS,
      salarioMin: 3000,
      salarioMax: 2000,
    });
    expect(r.success).toBe(false);
  });

  it("aceita só o piso, sem teto", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, salarioMin: 1800 });
    expect(r.success).toBe(true);
  });
});

describe("schemaEdicaoVaga", () => {
  it("exige o id, além dos campos da vaga", () => {
    const r = schemaEdicaoVaga.safeParse(DADOS);
    expect(r.success).toBe(false);
  });

  it("aceita com id", () => {
    const r = schemaEdicaoVaga.safeParse({ id: "vaga-1", ...DADOS });
    expect(r.success).toBe(true);
  });

  it("também recusa teto menor que o piso", () => {
    const r = schemaEdicaoVaga.safeParse({
      id: "vaga-1",
      ...DADOS,
      salarioMin: 3000,
      salarioMax: 2000,
    });
    expect(r.success).toBe(false);
  });
});

describe("schemaIdVaga", () => {
  it("aceita um id não vazio", () => {
    expect(schemaIdVaga.safeParse({ id: "vaga-1" }).success).toBe(true);
  });

  it("recusa id vazio", () => {
    expect(schemaIdVaga.safeParse({ id: "" }).success).toBe(false);
  });
});
