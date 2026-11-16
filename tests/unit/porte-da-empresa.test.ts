import { describe, expect, it } from "vitest";
import { porteDaEmpresa } from "@/lib/porte";

describe("porte da empresa por extenso (#626)", () => {
  it.each([
    ["MEI", "MEI"],
    ["Micro", "Microempresa"],
    ["Pequena", "Pequena empresa"],
    ["Média", "Média empresa"],
    ["Grande", "Grande empresa"],
  ])("%s vira %s", (valor, texto) => {
    expect(porteDaEmpresa(valor)).toBe(texto);
  });

  it("nunca escreve 'Porte média' nem sigla em minúscula", () => {
    for (const v of ["MEI", "Micro", "Pequena", "Média", "Grande"]) {
      expect(porteDaEmpresa(v)).not.toMatch(/^Porte /);
      expect(porteDaEmpresa(v)).not.toContain("mei");
    }
  });

  it("valor fora da lista aparece como veio", () => {
    expect(porteDaEmpresa("Cooperativa")).toBe("Cooperativa");
  });
});
