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
  tipoContrato: "CLT",
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

  it("recusa bairro fora de Sinop", () => {
    const r = schemaNovaVaga.safeParse({
      ...DADOS,
      bairro: "Bairro Inventado",
    });
    expect(r.success).toBe(false);
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
