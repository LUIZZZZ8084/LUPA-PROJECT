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

/**
 * As bordas de cada expressão, uma a uma.
 *
 * Os testes acima confirmam que o dado não vaza. Estes confirmam *qual*
 * regra pegou — e é isso que impede uma expressão de ser afrouxada sem
 * ninguém notar. Uma borda `(?<!\d)` removida por engano continua
 * mascarando telefone e passa em todos os testes de vazamento, mas começa
 * a picotar identificador numérico no meio e transforma relatório de erro
 * em charada.
 */
describe("bordas das expressões", () => {
  const limpar = (m: string) => scrubSensitiveData({ m }).m;

  it("CNPJ é reconhecido antes de CPF — os 11 primeiros dígitos coincidem", () => {
    // Sem a ordem certa, "12.345.678/0001-90" viraria "[cpf]" + sobra.
    expect(limpar("12345678000190")).toBe("[cnpj]");
    expect(limpar("12.345.678/0001-90")).toBe("[cnpj]");
  });

  it("telefone com DDI e com parênteses sai como telefone", () => {
    expect(limpar("+55 (66) 99911-0001")).toBe("[telefone]");
    expect(limpar("(66) 9991-0001")).toBe("[telefone]");
    expect(limpar("+5566999110001")).toBe("[telefone]");
  });

  it("CPF com máscara sai como cpf", () => {
    expect(limpar("123.456.789-00")).toBe("[cpf]");
  });

  it("não pica número maior no meio", () => {
    /*
     * Um timestamp em milissegundos tem 13 dígitos. Sem as bordas, a regra
     * de 10-11 dígitos comeria um pedaço e deixaria o resto solto —
     * "1756[telefone]" no lugar de um número que era só um horário.
     */
    for (const numero of ["1756132800000", "999999999999999"]) {
      expect(limpar(numero)).toBe(numero);
    }
  });

  it("sequência curta demais não é mascarada", () => {
    // Nove dígitos não são telefone brasileiro nem CPF; mascarar aqui
    // apagaria código de pedido e id numérico sem ganho de privacidade.
    expect(limpar("123456789")).toBe("123456789");
  });

  it("mascara todas as ocorrências, não só a primeira", () => {
    expect(limpar("de 66999110001 para 66999110002")).toBe(
      "de [telefone] para [telefone]",
    );
  });

  it("texto sem número atravessa intacto", () => {
    expect(limpar("falha ao gravar a vaga")).toBe("falha ao gravar a vaga");
  });
});
