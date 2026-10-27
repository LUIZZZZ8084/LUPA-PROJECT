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
  cidade: "Sinop - MT",
  tipoContrato: "CLT",
  modalidade: "presencial" as const,
  paraPcd: "nao",
  endereco: "Av. das Itaúbas, 1200",
};

/*
 * O título vai no aviso por push para até 500 pessoas, como notificação da
 * Lupa (#447): link ali é texto de um estranho com o nome da Lupa.
 */
describe("título sem link", () => {
  it.each([
    "Motorista https://vagas-rapidas.example",
    "Ganhe R$ 500 por dia em www.renda-extra.example",
    "Sua conta Lupa será bloqueada: lupa-seguranca.com",
    "Vendedor - LOJA.COM.BR",
    "Promotor de vendas renda.site",
  ])("recusa %s", (titulo) => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, titulo });
    expect(r.success).toBe(false);
    expect(
      !r.success && r.error.issues.some((i) => i.path[0] === "titulo"),
    ).toBe(true);
  });

  it.each([
    "Aux. de produção",
    "Analista de T.I.",
    "Motorista D/E",
    "Aux.comércio e estoque",
    "Eng. Agrônomo (Sr.)",
    "Téc. Seg. do Trabalho",
  ])("aceita %s", (titulo) => {
    expect(schemaNovaVaga.safeParse({ ...DADOS, titulo }).success).toBe(true);
  });
});

describe("schemaNovaVaga", () => {
  it("aceita o mínimo", () => {
    const r = schemaNovaVaga.safeParse(DADOS);
    expect(r.success).toBe(true);
  });

  /*
   * A modalidade é obrigatória em vaga nova (#300): é o selo que diz a
   * quem está em outra cidade se a vaga é para ele.
   */
  it("exige a modalidade", () => {
    const { modalidade: _, ...semModalidade } = DADOS;
    const r = schemaNovaVaga.safeParse(semModalidade);
    expect(r.success).toBe(false);
    expect(
      !r.success && r.error.issues.some((i) => i.path[0] === "modalidade"),
    ).toBe(true);
  });

  /*
   * A pergunta do PCD (#456) é obrigatória e não tem resposta de antemão:
   * "sim" e "nao" chegam do formulário, e ausência não é "não".
   */
  it("exige a resposta sobre PCD", () => {
    const { paraPcd: _, ...semResposta } = DADOS;
    const r = schemaNovaVaga.safeParse(semResposta);
    expect(r.success).toBe(false);
    expect(
      !r.success && r.error.issues.some((i) => i.path[0] === "paraPcd"),
    ).toBe(true);
  });

  it("'sim' e 'nao' viram booleano", () => {
    const sim = schemaNovaVaga.safeParse({ ...DADOS, paraPcd: "sim" });
    const nao = schemaNovaVaga.safeParse({ ...DADOS, paraPcd: "nao" });
    expect(sim.success && sim.data.paraPcd).toBe(true);
    expect(nao.success && nao.data.paraPcd).toBe(false);
  });

  it.each(["", "talvez", "true", "on", "SIM"])(
    "recusa %j: só sim ou não, e escrito certo",
    (paraPcd) => {
      expect(schemaNovaVaga.safeParse({ ...DADOS, paraPcd }).success).toBe(
        false,
      );
    },
  );

  it("aceita as três modalidades, e nada além delas", () => {
    for (const modalidade of ["presencial", "home_office", "hibrido"]) {
      expect(schemaNovaVaga.safeParse({ ...DADOS, modalidade }).success).toBe(
        true,
      );
    }
    expect(
      schemaNovaVaga.safeParse({ ...DADOS, modalidade: "remoto" }).success,
    ).toBe(false);
  });

  it("bairro em branco vira 'não informado', não erro", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, bairro: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.bairro).toBeUndefined();
  });

  /*
   * O bairro deixou de ser enum quando o app abriu para Mato Grosso
   * inteiro: não existe lista de bairros de 142 municípios, e enum
   * recusaria bairro novo até em Sinop. O que o servidor ainda garante é
   * tamanho — bairro de uma letra é engano de digitação, não bairro.
   */
  it("aceita bairro fora da lista curada", () => {
    const r = schemaNovaVaga.safeParse({
      ...DADOS,
      cidade: "Sorriso - MT",
      bairro: "Jardim Itália",
    });
    expect(r.success).toBe(true);
  });

  it("recusa bairro curto demais", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, bairro: "X" });
    expect(r.success).toBe(false);
  });

  it("recusa o que não é município do Brasil, com o estado", () => {
    for (const cidade of ["Curitiba", "sinop", "Sinop", "Sinop-MT", ""]) {
      const r = schemaNovaVaga.safeParse({ ...DADOS, cidade });
      expect(r.success, cidade || "(vazio)").toBe(false);
    }
  });

  it("aceita qualquer município do Brasil, não só de MT", () => {
    for (const cidade of [
      "Cuiabá - MT",
      "Sorriso - MT",
      "São Paulo - SP",
      "Bom Jesus - PI",
    ]) {
      const r = schemaNovaVaga.safeParse({ ...DADOS, cidade });
      expect(r.success, cidade).toBe(true);
    }
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

  /*
   * Aditivo ao bairro, não substituto — mas obrigatório, ao contrário
   * dele: é o que diz onde a vaga é de verdade para quem já decidiu se
   * candidatar.
   */
  it("recusa sem endereço", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, endereco: "" });
    expect(r.success).toBe(false);
  });

  it("recusa endereço curto demais", () => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, endereco: "Rua" });
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

/*
 * As perguntas de triagem (#491) chegam do formulário como `pergunta1..3` e
 * `eliminatoria1..3`, e saem como uma lista só.
 */
describe("perguntas de triagem", () => {
  const perguntasDe = (extra: Record<string, unknown>) => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, ...extra });
    return r.success ? r.data.perguntas : null;
  };

  it("vaga sem pergunta sai com lista vazia", () => {
    expect(perguntasDe({})).toEqual([]);
  });

  it("monta a lista na ordem escrita, com a marca de eliminatória", () => {
    expect(
      perguntasDe({
        pergunta1: "Tem CNH D?",
        eliminatoria1: "on",
        pergunta2: "Pode trabalhar à noite?",
        pergunta3: "Mora em Sinop?",
        eliminatoria3: "on",
      }),
    ).toEqual([
      { texto: "Tem CNH D?", eliminatoria: true },
      { texto: "Pode trabalhar à noite?", eliminatoria: false },
      { texto: "Mora em Sinop?", eliminatoria: true },
    ]);
  });

  /** Caixa desmarcada é ausência: não chega no formulário, e vale como "não". */
  it("eliminatória ausente é informativa", () => {
    expect(perguntasDe({ pergunta1: "Tem CNH D?" })).toEqual([
      { texto: "Tem CNH D?", eliminatoria: false },
    ]);
  });

  it("pula as em branco e junta as preenchidas", () => {
    expect(
      perguntasDe({
        pergunta1: "   ",
        pergunta2: "Tem CNH D?",
        eliminatoria2: "on",
        pergunta3: "",
        eliminatoria3: "on",
      }),
    ).toEqual([{ texto: "Tem CNH D?", eliminatoria: true }]);
  });

  /**
   * Pergunta é texto de terceiro que a Lupa mostra a quem tem conta; a
   * mesma regra do cargo (#447).
   */
  it.each([
    "Já viu https://vagas-rapidas.example?",
    "Conhece www.renda-extra.example?",
    "Quer ganhar mais em lupa-seguranca.com?",
  ])("recusa link: %s", (texto) => {
    const r = schemaNovaVaga.safeParse({ ...DADOS, pergunta1: texto });

    expect(r.success).toBe(false);
    expect(
      !r.success && r.error.issues.some((i) => i.path[0] === "pergunta1"),
    ).toBe(true);
  });

  it("aceita o que parece abreviação, e não link", () => {
    expect(perguntasDe({ pergunta1: "Tem CNH cat. D ou E?" })).toHaveLength(1);
    expect(
      perguntasDe({ pergunta1: "Já trabalhou como aux. de T.I.?" }),
    ).toHaveLength(1);
  });

  it("recusa pergunta curta demais ou longa demais", () => {
    expect(perguntasDe({ pergunta1: "Sim?" })).toBeNull();
    expect(perguntasDe({ pergunta1: `${"a".repeat(121)}?` })).toBeNull();
    expect(perguntasDe({ pergunta1: `${"a".repeat(119)}?` })).toHaveLength(1);
  });

  it("recusa a mesma pergunta duas vezes, mesmo com outra caixa", () => {
    const r = schemaNovaVaga.safeParse({
      ...DADOS,
      pergunta1: "Tem CNH D?",
      pergunta2: "TEM CNH D?",
    });

    expect(r.success).toBe(false);
    expect(
      !r.success && r.error.issues.some((i) => i.path[0] === "pergunta2"),
    ).toBe(true);
  });

  it("não deixa os campos soltos no resultado: só a lista", () => {
    const r = schemaNovaVaga.safeParse({
      ...DADOS,
      pergunta1: "Tem CNH D?",
      eliminatoria1: "on",
    });

    expect(r.success && Object.keys(r.data)).not.toEqual(
      expect.arrayContaining(["pergunta1", "eliminatoria1"]),
    );
    expect(r.success && "perguntas" in r.data).toBe(true);
  });
});
