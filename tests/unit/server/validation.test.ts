/**
 * @vitest-environment node
 *
 * Código de servidor não precisa de DOM. Rodar em node em vez de jsdom
 * corta dezenas de segundos da suíte.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  camposDoZod,
  celularValido,
  cnpjValido,
  cpfValido,
  objetoDoFormData,
  validar,
  zCelular,
  zCnpj,
  zEmail,
  zSenha,
  zTexto,
} from "@/server/validation";

describe("cpfValido", () => {
  it("aceita CPF com dígito verificador correto", () => {
    for (const cpf of ["529.982.247-25", "52998224725", "111.444.777-35"]) {
      expect(cpfValido(cpf), cpf).toBe(true);
    }
  });

  it("rejeita dígito verificador errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("111.444.777-00")).toBe(false);
  });

  /** Onze dígitos iguais passam na conta da soma, mas não existem. */
  it("rejeita sequência de dígitos repetidos", () => {
    for (let d = 0; d <= 9; d++) {
      expect(cpfValido(String(d).repeat(11)), `${d}`.repeat(11)).toBe(false);
    }
  });

  it("rejeita comprimento errado e texto", () => {
    expect(cpfValido("123")).toBe(false);
    expect(cpfValido("5299822472555")).toBe(false);
    expect(cpfValido("")).toBe(false);
    expect(cpfValido("abcdefghijk")).toBe(false);
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ com dígito verificador correto", () => {
    for (const cnpj of ["11.222.333/0001-81", "11222333000181"]) {
      expect(cnpjValido(cnpj), cnpj).toBe(true);
    }
  });

  it("rejeita dígito verificador errado", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita repetidos e comprimento errado", () => {
    expect(cnpjValido("11111111111111")).toBe(false);
    expect(cnpjValido("112223330001")).toBe(false);
  });
});

describe("celularValido", () => {
  it("aceita celular com DDD e nono dígito", () => {
    expect(celularValido("(66) 99911-0001")).toBe(true);
    expect(celularValido("66999110001")).toBe(true);
    expect(celularValido("5566999110001")).toBe(true);
  });

  it("rejeita fixo — o produto inteiro depende de WhatsApp", () => {
    expect(celularValido("6635112200")).toBe(false);
    expect(celularValido("66351122009")).toBe(false);
  });

  it("rejeita DDD impossível", () => {
    expect(celularValido("09999110001")).toBe(false);
    expect(celularValido("10999110001")).toBe(false);
  });
});

describe("schemas", () => {
  it("zEmail normaliza espaço e maiúscula", () => {
    const r = validar(zEmail, "  JOAO@Teste.COM  ");
    expect(r.ok && r.valor).toBe("joao@teste.com");
  });

  it("zEmail recusa endereço malformado", () => {
    expect(validar(zEmail, "joao@").ok).toBe(false);
    expect(validar(zEmail, "").ok).toBe(false);
  });

  it("zSenha exige comprimento, não composição", () => {
    expect(validar(zSenha, "curtinha").ok).toBe(false);
    // Sem símbolo nem maiúscula, e passa: comprimento protege mais do que
    // regra de composição, que empurra para senha anotada no papel.
    expect(validar(zSenha, "minha senha longa").ok).toBe(true);
  });

  it("zSenha tem teto, para não aceitar carga enorme", () => {
    expect(validar(zSenha, "a".repeat(201)).ok).toBe(false);
  });

  it("zCelular e zCnpj devolvem só dígitos", () => {
    const tel = validar(zCelular, "(66) 99911-0001");
    expect(tel.ok && tel.valor).toBe("66999110001");

    const cnpj = validar(zCnpj, "11.222.333/0001-81");
    expect(cnpj.ok && cnpj.valor).toBe("11222333000181");
  });

  it("zTexto respeita mínimo e máximo com mensagem em português", () => {
    const schema = zTexto(10, 20, "A descrição");
    const curto = validar(schema, "oi");
    expect(curto.ok).toBe(false);
    if (!curto.ok) {
      expect(curto.erro.campos?.[0].mensagem).toContain("A descrição");
    }
    expect(validar(schema, "a".repeat(21)).ok).toBe(false);
    expect(validar(schema, "tamanho certo").ok).toBe(true);
  });
});

describe("validar", () => {
  const schema = z.object({ nome: z.string().min(3), idade: z.number() });

  it("devolve o valor no caminho feliz", () => {
    const r = validar(schema, { nome: "João", idade: 30 });
    expect(r.ok && r.valor.nome).toBe("João");
  });

  it("devolve AppError de validação com os campos", () => {
    const r = validar(schema, { nome: "a", idade: "x" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro.codigo).toBe("validacao");
    expect(r.erro.status).toBe(422);
    expect(r.erro.campos?.map((c) => c.campo).sort()).toEqual([
      "idade",
      "nome",
    ]);
  });

  it("não lança — o erro vem no retorno", () => {
    expect(() => validar(schema, null)).not.toThrow();
  });
});

describe("camposDoZod", () => {
  it("guarda só a primeira mensagem de cada campo", () => {
    const schema = z.object({
      senha: z.string().min(10, "curta").regex(/\d/, "sem número"),
    });
    const parsed = schema.safeParse({ senha: "abc" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const campos = camposDoZod(parsed.error);
    expect(campos.filter((c) => c.campo === "senha")).toHaveLength(1);
  });

  it("usa caminho com ponto para campo aninhado", () => {
    const schema = z.object({
      empresa: z.object({ cnpj: z.string().min(14) }),
    });
    const parsed = schema.safeParse({ empresa: { cnpj: "1" } });
    if (parsed.success) return;
    expect(camposDoZod(parsed.error)[0].campo).toBe("empresa.cnpj");
  });
});

describe("objetoDoFormData", () => {
  it("converte campos de texto", () => {
    const fd = new FormData();
    fd.set("nome", "João");
    fd.set("email", "joao@teste.com");
    expect(objetoDoFormData(fd)).toEqual({
      nome: "João",
      email: "joao@teste.com",
    });
  });

  it("junta campo repetido numa lista", () => {
    const fd = new FormData();
    fd.append("bairros", "Centro");
    fd.append("bairros", "Menezes");
    expect(objetoDoFormData(fd).bairros).toEqual(["Centro", "Menezes"]);
  });

  /**
   * Arquivo passa junto com o texto.
   *
   * Antes era descartado, porque não havia envio de arquivo no app. Passou
   * a ser necessário com a foto de perfil, o currículo em PDF e a logo — o
   * envelope de action recebe o formulário inteiro e precisa entregar o
   * `File` ao schema.
   *
   * É seguro porque o envelope nunca registra os valores da entrada, só
   * nomes de campo em erro de validação. Se um dia passar a registrar,
   * este é o ponto que muda junto.
   */
  it("deixa arquivo passar, junto com o texto", () => {
    const fd = new FormData();
    fd.set("nome", "João");
    const arquivo = new File(["conteudo"], "rg.png", { type: "image/png" });
    fd.set("documento", arquivo);

    const saida = objetoDoFormData(fd);
    expect(saida.nome).toBe("João");
    expect(saida.documento).toBeInstanceOf(File);
  });

  /**
   * `FormData` normaliza `Blob` em `File` por especificação, então não
   * existe terceiro caso a filtrar: o que entra é texto ou arquivo.
   *
   * Vale registrar porque a leitura ingênua do código sugere que há um
   * `else` inalcançável — e alguém poderia "limpar" a checagem sem
   * perceber que ela é o que impede um valor futuro de passar direto.
   */
  it("Blob vira File, então tudo que passa é texto ou arquivo", () => {
    const fd = new FormData();
    fd.set("bloco", new Blob(["x"]));

    expect(objetoDoFormData(fd).bloco).toBeInstanceOf(File);
  });
});
