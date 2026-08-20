import { describe, expect, it } from "vitest";
import {
  formatCnpj,
  formatPhone,
  formatRating,
  formatSalaryRange,
  formatStartingPrice,
  initials,
  onlyDigits,
  pluralize,
  timeAgo,
  whatsappLink,
} from "@/lib/format";

/** Espaço não-quebrável que o Intl insere depois de "R$". */
const NB = " ";

describe("formatSalaryRange", () => {
  it("mostra a faixa quando há piso e teto", () => {
    expect(formatSalaryRange(3200, 4200)).toBe(
      `R$${NB}3.200 – R$${NB}4.200`,
    );
  });

  it("usa 'a partir de' quando só há piso", () => {
    expect(formatSalaryRange(1600, null)).toBe(`A partir de R$${NB}1.600`);
  });

  it("usa 'até' quando só há teto", () => {
    expect(formatSalaryRange(null, 2500)).toBe(`Até R$${NB}2.500`);
  });

  it("cai para 'A combinar' sem valores", () => {
    expect(formatSalaryRange(null, null)).toBe("A combinar");
    expect(formatSalaryRange(undefined, undefined)).toBe("A combinar");
  });

  it("trata zero como ausência de valor, não como salário zerado", () => {
    expect(formatSalaryRange(0, 0)).toBe("A combinar");
  });
});

describe("formatStartingPrice", () => {
  it("prefixa com 'A partir de'", () => {
    expect(formatStartingPrice(150)).toBe(`A partir de R$${NB}150`);
  });

  it("indica preço a combinar quando não informado", () => {
    expect(formatStartingPrice(null)).toBe("Preço a combinar");
  });
});

describe("formatRating", () => {
  it("usa vírgula decimal, como se lê em português", () => {
    expect(formatRating(4.8)).toBe("4,8");
    expect(formatRating(5)).toBe("5,0");
  });

  it("arredonda para uma casa", () => {
    expect(formatRating(4.75)).toBe("4,8");
    expect(formatRating(4.24)).toBe("4,2");
  });
});

describe("onlyDigits", () => {
  it("remove máscara de telefone", () => {
    expect(onlyDigits("(66) 99911-0001")).toBe("66999110001");
  });

  it("remove máscara de CNPJ", () => {
    expect(onlyDigits("12.345.678/0001-90")).toBe("12345678000190");
  });
});

describe("formatPhone", () => {
  it("formata celular de 11 dígitos", () => {
    expect(formatPhone("66999110001")).toBe("(66) 99911-0001");
  });

  it("formata fixo de 10 dígitos", () => {
    expect(formatPhone("6635112200")).toBe("(66) 3511-2200");
  });

  it("descarta o DDI 55 antes de formatar", () => {
    expect(formatPhone("5566999110001")).toBe("(66) 99911-0001");
  });

  it("devolve a entrada quando não reconhece o formato", () => {
    expect(formatPhone("123")).toBe("123");
  });
});

describe("formatCnpj", () => {
  it("aplica a máscara", () => {
    expect(formatCnpj("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("devolve a entrada quando o tamanho não bate", () => {
    expect(formatCnpj("123")).toBe("123");
  });
});

describe("whatsappLink", () => {
  it("monta o deep link com DDI e mensagem codificada", () => {
    const link = whatsappLink("66999110001", "Olá, tudo bem?");
    expect(link).toBe(
      "https://wa.me/5566999110001?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
  });

  it("não duplica o DDI quando já vem no número", () => {
    expect(whatsappLink("5566999110001", "oi")).toContain(
      "wa.me/5566999110001",
    );
  });

  it("ignora a máscara do número", () => {
    expect(whatsappLink("(66) 99911-0001", "oi")).toContain(
      "wa.me/5566999110001",
    );
  });
});

describe("initials", () => {
  it("usa as duas primeiras palavras", () => {
    expect(initials("João Silva")).toBe("JS");
    expect(initials("Ana Paula Ribeiro")).toBe("AP");
  });

  it("funciona com nome único", () => {
    expect(initials("Paulinho")).toBe("P");
  });

  it("tolera espaços extras", () => {
    expect(initials("  Carlos   Souza  ")).toBe("CS");
  });
});

describe("timeAgo", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("mostra 'agora' abaixo de um minuto", () => {
    expect(timeAgo(ago(30_000))).toBe("agora");
  });

  it("mostra minutos, horas e dias", () => {
    expect(timeAgo(ago(5 * 60_000))).toBe("há 5min");
    expect(timeAgo(ago(3 * 3_600_000))).toBe("há 3h");
    expect(timeAgo(ago(2 * 86_400_000))).toBe("há 2d");
  });

  it("mostra semanas e meses", () => {
    expect(timeAgo(ago(14 * 86_400_000))).toBe("há 2 sem");
    expect(timeAgo(ago(60 * 86_400_000))).toBe("há 2 meses");
  });

  it("usa singular para um mês", () => {
    expect(timeAgo(ago(35 * 86_400_000))).toBe("há 1 mês");
  });
});

describe("pluralize", () => {
  it("escolhe singular e plural", () => {
    expect(pluralize(1, "vaga", "vagas")).toBe("1 vaga");
    expect(pluralize(3, "vaga", "vagas")).toBe("3 vagas");
    expect(pluralize(0, "vaga", "vagas")).toBe("0 vagas");
  });
});
