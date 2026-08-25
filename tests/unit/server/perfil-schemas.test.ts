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

describe("anúncio do prestador", () => {
  const base = {
    categoriaId: "1",
    descricao: "Instalações elétricas residenciais e comerciais em Sinop.",
    precoInicial: "",
    anosExperiencia: "",
    bairrosAtendidos: [],
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
});

describe("empresa", () => {
  const base = {
    razaoSocial: "Agro Norte Ltda.",
    setor: "",
    porte: "",
    site: "",
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
