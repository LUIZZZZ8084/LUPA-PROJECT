/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { schemaMoverCandidatura } from "@/server/candidaturas/schemas";

describe("schemaMoverCandidatura", () => {
  it("aceita id e um estágio válido", () => {
    const r = schemaMoverCandidatura.safeParse({
      id: "candidatura-1",
      status: "entrevista",
    });
    expect(r.success).toBe(true);
  });

  it("recusa estágio inválido", () => {
    const r = schemaMoverCandidatura.safeParse({
      id: "candidatura-1",
      status: "contratado",
    });
    expect(r.success).toBe(false);
  });

  it("recusa id vazio", () => {
    const r = schemaMoverCandidatura.safeParse({
      id: "",
      status: "entrevista",
    });
    expect(r.success).toBe(false);
  });
});
