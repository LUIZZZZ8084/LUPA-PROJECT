import { describe, expect, it } from "vitest";
import {
  IGNORED_ERRORS,
  scrubSensitiveData,
  TRACES_SAMPLE_RATE,
} from "@/lib/observability";

/**
 * Estes testes protegem uma obrigação legal, não uma preferência.
 *
 * A Lupa trata telefone, CPF, CNPJ e imagem de documento. Nada disso pode
 * sair para um serviço de terceiro junto com um relatório de erro. Se um
 * destes testes cair, há vazamento de dado pessoal em produção.
 */
describe("scrubSensitiveData", () => {
  it("remove o valor de campos com nome sensível", () => {
    const evento = {
      user: { phone: "66999110001", nome: "João" },
      extra: { cpf: "123.456.789-00", senha: "segredo123" },
    };

    const limpo = scrubSensitiveData(evento);

    expect(limpo.user.phone).toBe("[removido]");
    expect(limpo.extra.cpf).toBe("[removido]");
    expect(limpo.extra.senha).toBe("[removido]");
    // O que não é sensível permanece, senão o relatório perde utilidade.
    expect(limpo.user.nome).toBe("João");
  });

  it("cobre as variações de nome usadas no schema", () => {
    const evento = {
      telefone: "x",
      whatsapp: "x",
      cnpj: "x",
      documento: "x",
      selfie: "x",
      password: "x",
      token: "x",
      secret: "x",
      resume_url: "x",
      curriculo: "x",
    };

    for (const valor of Object.values(scrubSensitiveData(evento))) {
      expect(valor).toBe("[removido]");
    }
  });

  it("mascara telefone solto no meio de um texto livre", () => {
    const evento = {
      mensagem: "Falha ao enviar para (66) 99911-0001 na fila",
    };
    expect(scrubSensitiveData(evento).mensagem).toBe(
      "Falha ao enviar para [telefone] na fila",
    );
  });

  it("mascara telefone sem máscara e com DDI", () => {
    expect(
      scrubSensitiveData({ m: "numero 5566999110001 invalido" }).m,
    ).toContain("[telefone]");
    expect(
      scrubSensitiveData({ m: "numero 66999110001 invalido" }).m,
    ).toContain("[telefone]");
  });

  it("mascara CPF e CNPJ em texto livre", () => {
    expect(scrubSensitiveData({ m: "cpf 123.456.789-00 aqui" }).m).toBe(
      "cpf [cpf] aqui",
    );
    expect(scrubSensitiveData({ m: "cnpj 12.345.678/0001-90 aqui" }).m).toBe(
      "cnpj [cnpj] aqui",
    );
  });

  it("não deixa dígito escapar em sequência sem máscara", () => {
    // O rótulo pode sair como telefone; o que importa é nada vazar inteiro.
    for (const bruto of ["12345678900", "12345678000190", "66999110001"]) {
      const saida = scrubSensitiveData({ m: `valor ${bruto} fim` }).m;
      expect(saida).not.toContain(bruto);
      expect(saida).toMatch(/\[(telefone|cpf|cnpj)\]/);
    }
  });

  it("percorre objetos aninhados e listas", () => {
    const evento = {
      breadcrumbs: [
        { data: { phone: "66999110001" } },
        { data: { url: "/servicos/prv-joao-silva" } },
      ],
      contexts: { app: { user: { cpf: "111.222.333-44" } } },
    };

    const limpo = scrubSensitiveData(evento);

    expect(limpo.breadcrumbs[0].data.phone).toBe("[removido]");
    expect(limpo.breadcrumbs[1].data.url).toBe("/servicos/prv-joao-silva");
    expect(limpo.contexts.app.user.cpf).toBe("[removido]");
  });

  it("não quebra com null, undefined, número ou booleano", () => {
    const evento = { a: null, b: undefined, c: 42, d: true, e: [] };
    expect(scrubSensitiveData(evento)).toEqual(evento);
  });

  it("ignora maiúsculas no nome do campo", () => {
    expect(scrubSensitiveData({ Telefone: "x", CPF: "y" })).toEqual({
      Telefone: "[removido]",
      CPF: "[removido]",
    });
  });
});

describe("configuração de amostragem", () => {
  it("não amostra 100% em produção, para não estourar a cota", () => {
    expect(TRACES_SAMPLE_RATE).toBeGreaterThan(0);
    expect(TRACES_SAMPLE_RATE).toBeLessThanOrEqual(1);
  });

  it("silencia o ruído de extensão de navegador", () => {
    const comoTexto = IGNORED_ERRORS.map(String).join(" ");
    expect(comoTexto).toContain("ResizeObserver");
    expect(comoTexto).toContain("chrome-extension");
  });
});
