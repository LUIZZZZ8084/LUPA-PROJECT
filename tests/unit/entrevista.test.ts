/**
 * A entrevista como a tela a mostra (#539): a hora é de parede, e nunca
 * passa por conversão de fuso.
 */
import { describe, expect, it } from "vitest";
import { mensagemDeEntrevista } from "@/lib/chamada";
import {
  entrevistasProximas,
  formatarEntrevista,
  hojeEmBrasilia,
} from "@/lib/entrevista";

describe("formatarEntrevista", () => {
  it("dia da semana, data e hora, sem mexer na hora escrita", () => {
    expect(formatarEntrevista("2026-11-06T14:30")).toBe("sex, 06/11 às 14:30");
    expect(formatarEntrevista("2026-11-08T08:05")).toBe("dom, 08/11 às 08:05");
  });
});

describe("hojeEmBrasilia", () => {
  it("vira o dia em Brasília, e não em UTC", () => {
    // 01:00 UTC do dia 6 ainda é dia 5 em Brasília (UTC-3).
    expect(hojeEmBrasilia(new Date("2026-11-06T01:00:00Z"))).toBe("2026-11-05");
    expect(hojeEmBrasilia(new Date("2026-11-06T04:00:00Z"))).toBe("2026-11-06");
  });
});

describe("entrevistasProximas", () => {
  it("de hoje em diante, da mais próxima para a mais distante", () => {
    const lista = [
      { id: "a", entrevistaEm: "2026-11-10T09:00" },
      { id: "b", entrevistaEm: null },
      { id: "c", entrevistaEm: "2026-11-04T09:00" },
      { id: "d", entrevistaEm: "2026-11-05T08:00" },
    ];
    expect(entrevistasProximas(lista, "2026-11-05").map((e) => e.id)).toEqual([
      "d",
      "a",
    ]);
  });
});

describe("mensagemDeEntrevista", () => {
  it("convida com o dia, a hora, o local, e pede confirmação", () => {
    expect(
      mensagemDeEntrevista({
        candidato: "Maria da Silva",
        vaga: "Motorista",
        empresa: "Agro Norte",
        quando: "sex, 06/11 às 14:30",
        local: "Av. das Itaúbas, 1200",
      }),
    ).toBe(
      "Olá, Maria! Aqui é da Agro Norte. Gostaríamos de convidar você para " +
        "uma entrevista para a vaga de Motorista, sex, 06/11 às 14:30, em " +
        "Av. das Itaúbas, 1200. Pode confirmar?",
    );
  });

  it("sem local, não inventa um", () => {
    expect(
      mensagemDeEntrevista({
        candidato: "Maria",
        vaga: "Motorista",
        empresa: "Agro Norte",
        quando: "sex, 06/11 às 14:30",
        local: null,
      }),
    ).toContain("sex, 06/11 às 14:30. Pode confirmar?");
  });
});
