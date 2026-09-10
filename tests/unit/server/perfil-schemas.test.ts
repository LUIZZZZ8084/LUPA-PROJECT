/**
 * @vitest-environment node
 *
 * O cadastro pede o mínimo para a conta existir; a edição é onde o resto
 * entra, depois que a pessoa já viu que a plataforma tem gente de verdade.
 *
 * O ponto delicado aqui é campo opcional em branco. Um formulário HTML
 * manda `""`, e gravar isso faria "não informado" e "informado como nada"
 * virarem a mesma coisa no banco — a tela então mostraria um campo vazio
 * como se estivesse preenchido.
 */
import { describe, expect, it } from "vitest";
import {
  schemaBasico,
  schemaCandidato,
  schemaEmpresa,
  schemaPrestador,
} from "@/server/perfil/schemas";

describe("dados da conta", () => {
  it("aceita o mínimo", () => {
    const r = schemaBasico.safeParse({
      nomeCompleto: "Ana Paula Ribeiro",
      telefone: "66999110005",
      bairro: "",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.bairro).toBeNull();
  });

  it("recusa telefone que não é celular", () => {
    const r = schemaBasico.safeParse({
      nomeCompleto: "Ana",
      telefone: "6635110001",
      bairro: "",
    });
    expect(r.success).toBe(false);
  });

  /*
   * Bairro virou texto quando o app abriu para Mato Grosso inteiro. Enum
   * exigiria a lista dos 142 municípios, que não existe pronta — e
   * recusaria loteamento novo até em Sinop, onde a cidade cresce todo ano.
   */
  it("aceita bairro que não está em nenhuma lista curada", () => {
    const r = schemaBasico.safeParse({
      nomeCompleto: "Ana Paula",
      telefone: "66999110005",
      bairro: "Residencial Nova Fronteira",
    });
    expect(r.success).toBe(true);
  });

  it("recusa bairro de uma letra — isso é engano de digitação", () => {
    const r = schemaBasico.safeParse({
      nomeCompleto: "Ana Paula",
      telefone: "66999110005",
      bairro: "X",
    });
    expect(r.success).toBe(false);
  });
});

describe("currículo", () => {
  it("tudo em branco é válido — o currículo é opcional", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.areaDesejada).toBeNull();
    expect(r.success && r.data.habilidades).toEqual([]);
  });

  /**
   * Habilidades chegam como texto separado por vírgula: no celular a pessoa
   * digita como fala, e um seletor de tags seria pior.
   */
  it("quebra habilidades por vírgula e limpa o que sobra", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "Agronegócio",
      resumo: "",
      formacao: "",
      habilidades: " CNH categoria C , Colheitadeira ,, Trator ,",
      disponibilidade: "",
    });
    expect(r.success && r.data.habilidades).toEqual([
      "CNH categoria C",
      "Colheitadeira",
      "Trator",
    ]);
  });

  it("recusa área que não está na lista", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "Astronauta",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
    });
    expect(r.success).toBe(false);
  });

  it("limita a quantidade de habilidades", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: Array.from({ length: 21 }, (_, i) => `h${i}`).join(","),
      disponibilidade: "",
    });
    expect(r.success).toBe(false);
  });
});

/**
 * O formulário manda quatro listas paralelas — `expCargo`, `expEmpresa`,
 * `expPeriodo`, `expDescricao` — uma posição por linha da tela. O schema
 * zipa as quatro numa lista de experiências antes de validar cada uma.
 */
describe("experiência do currículo", () => {
  it("sem nenhuma linha, a lista fica vazia", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
    });
    expect(r.success && r.data.experiencias).toEqual([]);
  });

  it("uma linha só chega como string, não como lista de um item", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
      expCargo: "Operador de colheitadeira",
      expEmpresa: "Agro Norte Ltda.",
      expPeriodo: "2021 — 2023",
      expDescricao: "",
    });
    expect(r.success && r.data.experiencias).toEqual([
      {
        role: "Operador de colheitadeira",
        company: "Agro Norte Ltda.",
        period: "2021 — 2023",
        description: undefined,
      },
    ]);
  });

  it("zipa várias linhas pela posição", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
      expCargo: ["Operador", "Auxiliar"],
      expEmpresa: ["Agro Norte", "Sítio Bom Jesus"],
      expPeriodo: ["2021 — 2023", "2019 — 2021"],
      expDescricao: ["Colheita mecanizada.", ""],
    });
    expect(r.success && r.data.experiencias).toEqual([
      {
        role: "Operador",
        company: "Agro Norte",
        period: "2021 — 2023",
        description: "Colheita mecanizada.",
      },
      {
        role: "Auxiliar",
        company: "Sítio Bom Jesus",
        period: "2019 — 2021",
        description: undefined,
      },
    ]);
  });

  /**
   * Uma linha que a pessoa adicionou e não preencheu não pode virar erro
   * de validação — ela nem tentou usar aquela linha.
   */
  it("linha inteiramente em branco é descartada, não recusada", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
      expCargo: "",
      expEmpresa: "",
      expPeriodo: "",
      expDescricao: "",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.experiencias).toEqual([]);
  });

  it("linha parcialmente preenchida é recusada", () => {
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
      expCargo: "Operador",
      expEmpresa: "",
      expPeriodo: "",
      expDescricao: "",
    });
    expect(r.success).toBe(false);
  });

  it("limita a quantidade de experiências", () => {
    const n = 11;
    const r = schemaCandidato.safeParse({
      areaDesejada: "",
      resumo: "",
      formacao: "",
      habilidades: "",
      disponibilidade: "",
      expCargo: Array.from({ length: n }, (_, i) => `Cargo ${i}`),
      expEmpresa: Array.from({ length: n }, (_, i) => `Empresa ${i}`),
      expPeriodo: Array.from({ length: n }, () => "2020 — 2021"),
      expDescricao: Array.from({ length: n }, () => ""),
    });
    expect(r.success).toBe(false);
  });
});

describe("anúncio do prestador", () => {
  const base = {
    categoriaId: "1",
    descricao: "Instalações elétricas residenciais e comerciais em Sinop.",
    precoInicial: "",
    anosExperiencia: "",
    bairrosAtendidos: [],
    instagram: "",
    facebook: "",
  };

  it("aceita o anúncio mínimo", () => {
    const r = schemaPrestador.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.precoInicial).toBeNull();
  });

  /**
   * Categoria e descrição são obrigatórias só aqui. Sem elas o prestador
   * não aparece na busca, ninguém o encontra, e a conclusão dele é que a
   * plataforma não funciona.
   */
  it("exige categoria", () => {
    expect(
      schemaPrestador.safeParse({ ...base, categoriaId: "" }).success,
    ).toBe(false);
  });

  it("exige descrição com conteúdo de verdade", () => {
    expect(
      schemaPrestador.safeParse({ ...base, descricao: "faço de tudo" }).success,
    ).toBe(false);
  });

  it("recusa categoria que não existe", () => {
    expect(
      schemaPrestador.safeParse({ ...base, categoriaId: "999" }).success,
    ).toBe(false);
  });

  it("converte números que chegam como texto", () => {
    const r = schemaPrestador.safeParse({
      ...base,
      precoInicial: "150",
      anosExperiencia: "7",
    });
    expect(r.success && r.data.precoInicial).toBe(150);
    expect(r.success && r.data.anosExperiencia).toBe(7);
  });

  it("recusa preço negativo", () => {
    expect(
      schemaPrestador.safeParse({ ...base, precoInicial: "-10" }).success,
    ).toBe(false);
  });

  /** Um bairro só chega como string; vários, como lista. */
  it("aceita um bairro ou vários", () => {
    const um = schemaPrestador.safeParse({
      ...base,
      bairrosAtendidos: "Centro",
    });
    expect(um.success && um.data.bairrosAtendidos).toEqual(["Centro"]);

    const varios = schemaPrestador.safeParse({
      ...base,
      bairrosAtendidos: ["Centro", "Menezes"],
    });
    expect(varios.success && varios.data.bairrosAtendidos).toHaveLength(2);
  });

  it("instagram e facebook são opcionais", () => {
    const r = schemaPrestador.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.instagram).toBeNull();
    expect(r.success && r.data.facebook).toBeNull();
  });

  it("recusa instagram que não é endereço", () => {
    expect(
      schemaPrestador.safeParse({ ...base, instagram: "arroba_fulano" })
        .success,
    ).toBe(false);
  });

  it("aceita instagram e facebook válidos", () => {
    const r = schemaPrestador.safeParse({
      ...base,
      instagram: "https://instagram.com/fulano",
      facebook: "https://facebook.com/fulano",
    });
    expect(r.success).toBe(true);
  });
});

describe("empresa", () => {
  const base = {
    razaoSocial: "Agro Norte Ltda.",
    setor: "",
    porte: "",
    site: "",
    instagram: "",
    facebook: "",
    descricao: "",
  };

  it("aceita só a razão social", () => {
    const r = schemaEmpresa.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.site).toBeNull();
  });

  it("recusa site que não é endereço", () => {
    expect(
      schemaEmpresa.safeParse({ ...base, site: "agronorte" }).success,
    ).toBe(false);
  });

  it("aceita site válido", () => {
    const r = schemaEmpresa.safeParse({
      ...base,
      site: "https://agronorte.com.br",
    });
    expect(r.success).toBe(true);
  });

  it("instagram e facebook são opcionais, e também precisam ser endereço", () => {
    expect(schemaEmpresa.safeParse(base).success).toBe(true);
    expect(
      schemaEmpresa.safeParse({ ...base, instagram: "agronorte" }).success,
    ).toBe(false);
    expect(
      schemaEmpresa.safeParse({
        ...base,
        instagram: "https://instagram.com/agronorte",
        facebook: "https://facebook.com/agronorte",
      }).success,
    ).toBe(true);
  });

  /**
   * O CNPJ é âncora de identidade, não campo de perfil: poder trocar
   * depois permitiria passar pela verificação e virar outra empresa.
   */
  it("não tem campo de CNPJ", () => {
    expect(Object.keys(schemaEmpresa.shape)).not.toContain("cnpj");
  });

  it("recusa porte fora da lista", () => {
    expect(schemaEmpresa.safeParse({ ...base, porte: "Gigante" }).success).toBe(
      false,
    );
  });
});
