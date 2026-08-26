/**
 * @vitest-environment node
 *
 * Habilidades comparáveis entre si.
 *
 * O que estes testes protegem é o casamento entre o que a vaga pede e o
 * que o candidato escreveu — e o público deste app digita rápido, no
 * celular, sem acento e sem padrão. Comparação exata erraria na maioria
 * dos casos reais, e a empresa concluiria que a recomendação não funciona.
 */
import { describe, expect, it } from "vitest";
import {
  casar,
  formaCanonica,
  habilidadesDaVaga,
  habilidadesNoTexto,
  normalizarHabilidade,
} from "@/lib/skills";

describe("normalização", () => {
  it("tira acento, caixa e espaço sobrando", () => {
    expect(normalizarHabilidade("  Mecânico ELÉTRICO  ")).toBe(
      "mecanico eletrico",
    );
  });

  /*
   * Este é o caso que motiva o módulo inteiro. Metade do público digita
   * sem acento; quem escreveu "mecanico" não pode ficar de fora de uma
   * vaga que pede "Mecânico".
   */
  it("com e sem acento viram a mesma coisa", () => {
    expect(normalizarHabilidade("Manutenção")).toBe(
      normalizarHabilidade("manutencao"),
    );
    expect(normalizarHabilidade("Produção")).toBe("producao");
  });

  it("pontuação vira separador, não desaparece colando palavras", () => {
    expect(normalizarHabilidade("CNH-D")).toBe("cnh d");
    expect(normalizarHabilidade("Excel/Word")).toBe("excel word");
  });

  it("texto vazio não vira lixo", () => {
    expect(normalizarHabilidade("   ")).toBe("");
    expect(normalizarHabilidade(",,,")).toBe("");
  });
});

describe("sinônimos do vocabulário daqui", () => {
  it.each([
    ["CNH D", "carteira D"],
    ["colheitadeira", "colhedora"],
    ["Excel", "pacote office"],
    ["empilhadeira", "Operador de empilhadeira"],
    ["eletricista", "instalação elétrica"],
    ["carreta", "CNH E"],
  ])("%s e %s casam", (a, b) => {
    expect(formaCanonica(a)).toBe(formaCanonica(b));
  });

  it("coisas diferentes continuam diferentes", () => {
    expect(formaCanonica("CNH B")).not.toBe(formaCanonica("CNH D"));
    expect(formaCanonica("pedreiro")).not.toBe(formaCanonica("pintor"));
  });

  /*
   * A tabela cobre o que aparece por aqui; o que ela não conhece precisa
   * continuar funcionando pela normalização, senão só as habilidades
   * previstas casariam e a lista viraria uma camisa de força.
   */
  it("habilidade fora da tabela casa por ela mesma", () => {
    expect(formaCanonica("Soldagem MIG")).toBe("soldagem mig");
    expect(formaCanonica("soldagem  MIG ")).toBe(formaCanonica("Soldagem mig"));
  });
});

describe("habilidades reconhecidas no texto da vaga", () => {
  it("acha o que a tabela conhece", () => {
    const achadas = habilidadesNoTexto(
      "Operador de colheitadeira para safra de soja. Exige CNH D.",
    );
    expect(achadas).toContain("colheitadeira");
    expect(achadas).toContain("cnh d");
  });

  /*
   * Sem limite de palavra, "caixa" casaria dentro de "caixaria" e
   * "vendas" dentro de "revendas" — e a vaga passaria a pedir habilidade
   * que ninguém escreveu.
   */
  it("não casa pedaço de palavra", () => {
    expect(habilidadesNoTexto("trabalho em caixaria de madeira")).not.toContain(
      "caixa",
    );
    expect(habilidadesNoTexto("atende revendas da região")).not.toContain(
      "vendas",
    );
  });

  it("texto sem habilidade conhecida devolve lista vazia", () => {
    expect(habilidadesNoTexto("Buscamos alguém dedicado e pontual")).toEqual(
      [],
    );
  });
});

describe("o que a vaga pede", () => {
  const VAGA = {
    titulo: "Operador de Empilhadeira",
    descricao: "Movimentação de carga no armazém. Controle de estoque.",
  };

  it("o campo declarado ganha do texto", () => {
    const pedidas = habilidadesDaVaga({
      ...VAGA,
      habilidades: ["Excel", "CNH B"],
    });

    expect(pedidas.sort()).toEqual(["cnh b", "excel"]);
    // O texto fala de empilhadeira, mas a empresa declarou outra coisa.
    expect(pedidas).not.toContain("empilhadeira");
  });

  /*
   * Toda vaga publicada antes do campo existir chega aqui sem habilidade
   * declarada. Sem o texto como reserva, o bloco de recomendados nasceria
   * vazio para todo mundo — e ninguém preenche um campo cujo resultado
   * nunca viu.
   */
  it("sem campo declarado, lê o título e a descrição", () => {
    const pedidas = habilidadesDaVaga(VAGA);
    expect(pedidas).toContain("empilhadeira");
    expect(pedidas).toContain("almoxarifado");
  });

  it("campo vazio conta como não declarado", () => {
    expect(habilidadesDaVaga({ ...VAGA, habilidades: [] })).toEqual(
      habilidadesDaVaga(VAGA),
    );
  });
});

describe("casamento entre vaga e candidato", () => {
  it("conta o que casou e devolve o texto do candidato", () => {
    const r = casar(
      ["colheitadeira", "cnh d"],
      ["Colhedora", "Carteira D", "Solda"],
    );

    expect(r.pontos).toBe(2);
    expect(r.proporcao).toBe(1);
    // O que a tela mostra é o que a pessoa escreveu, não a forma interna.
    expect(r.casadas.map((c) => c.texto).sort()).toEqual([
      "Carteira D",
      "Colhedora",
    ]);
  });

  it("casamento parcial vira proporção, não tudo ou nada", () => {
    const r = casar(["excel", "erp", "conciliacao bancaria"], ["Planilhas"]);

    expect(r.pontos).toBe(1);
    expect(r.proporcao).toBeCloseTo(1 / 3);
  });

  it("quem não tem nada em comum pontua zero", () => {
    expect(casar(["excel"], ["pedreiro"]).pontos).toBe(0);
  });

  it("vaga que não pede nada não inventa afinidade", () => {
    const r = casar([], ["Excel", "CNH D"]);
    expect(r.pontos).toBe(0);
    expect(r.proporcao).toBe(0);
  });

  it("habilidade repetida no candidato não conta duas vezes", () => {
    const r = casar(["excel"], ["Excel", "excel", "PACOTE OFFICE"]);
    expect(r.pontos).toBe(1);
  });

  it("habilidade repetida na vaga também não infla o total", () => {
    const r = casar(["excel", "Excel", "office"], ["Planilha"]);
    expect(r.proporcao).toBe(1);
  });
});
