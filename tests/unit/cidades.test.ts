/**
 * @vitest-environment node
 *
 * O app deixou de ser só de Sinop.
 *
 * A promessa do AGENTS.md desde o V0 era "abrir outra cidade não deve
 * exigir migração de schema". Estes testes cobram a promessa: a lista de
 * municípios, a validação que decide quem entra, e o filtro que separa uma
 * cidade da outra.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import {
  bairrosDe,
  CIDADE_INICIAL,
  CIDADES,
  ehCidadeAtendida,
  rotuloDaCidade,
} from "@/lib/constants";
import { getJobs, getProviders } from "@/lib/data";

describe("municípios de Mato Grosso", () => {
  /*
   * O número é a conferência de que o arquivo gerado não foi truncado.
   * MT tem 142 municípios desde 2025, quando Boa Esperança do Norte foi
   * instalada. Se o IBGE criar outro, este teste falha e alguém roda
   * `node scripts/gerar-cidades.mjs` — que é exatamente o lembrete que se
   * quer.
   */
  it("são os 142 do estado", () => {
    expect(CIDADES).toHaveLength(142);
  });

  it("não tem nome repetido nem em branco", () => {
    expect(new Set(CIDADES).size).toBe(CIDADES.length);
    expect(CIDADES.every((c) => c.trim().length > 2)).toBe(true);
  });

  it("está em ordem alfabética de pt-BR — acento não vai para o fim", () => {
    const ordenada = [...CIDADES].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect(CIDADES).toEqual(ordenada);
  });

  it("traz os nomes compostos inteiros, sem cortar no espaço", () => {
    expect(CIDADES).toContain("Vila Bela da Santíssima Trindade");
    expect(CIDADES).toContain("Lucas do Rio Verde");
    expect(CIDADES).toContain("Campo Novo do Parecis");
  });

  it("a cidade inicial continua sendo Sinop", () => {
    expect(CIDADE_INICIAL).toBe("Sinop");
    expect(CIDADES).toContain(CIDADE_INICIAL);
  });
});

describe("quem é aceito no cadastro", () => {
  it("qualquer município de MT entra", () => {
    for (const c of ["Sinop", "Cuiabá", "Sorriso", "Vera", "Alta Floresta"]) {
      expect(ehCidadeAtendida(c), c).toBe(true);
    }
  });

  /*
   * A comparação é exata de propósito. Aceitar "sinop" e "Sinop - MT"
   * pareceria gentileza, mas encheria a base de três grafias da mesma
   * cidade — e o filtro de cidade, que é o que faz o app ser hiperlocal,
   * deixaria de agrupar.
   */
  it("variação de grafia não entra", () => {
    for (const c of ["sinop", "SINOP", "Sinop - MT", "Sinop ", ""]) {
      expect(ehCidadeAtendida(c), JSON.stringify(c)).toBe(false);
    }
  });

  it("cidade de outro estado não entra", () => {
    for (const c of ["Curitiba", "São Paulo", "Goiânia"]) {
      expect(ehCidadeAtendida(c), c).toBe(false);
    }
  });

  it("o rótulo mostra o estado junto", () => {
    expect(rotuloDaCidade("Sorriso")).toBe("Sorriso - MT");
  });
});

describe("bairro: lista onde existe, texto onde não existe", () => {
  it("Sinop tem lista curada", () => {
    expect(bairrosDe("Sinop").length).toBeGreaterThan(10);
    expect(bairrosDe("Sinop")).toContain("Centro");
  });

  /*
   * Não é falta: é a decisão. Manter bairro de 142 municípios não existe
   * pronto em lugar nenhum e envelheceria sozinho. Onde não há curadoria,
   * a tela pede texto — e o servidor aceita.
   */
  it("as outras cidades ficam sem lista, e isso é o combinado", () => {
    for (const c of ["Cuiabá", "Sorriso", "Alta Floresta"]) {
      expect(bairrosDe(c), c).toEqual([]);
    }
  });

  it("cidade nula ou vazia não quebra", () => {
    expect(bairrosDe(null)).toEqual([]);
    expect(bairrosDe(undefined)).toEqual([]);
    expect(bairrosDe("")).toEqual([]);
  });
});

/**
 * O que o critério de aceite da Issue #62 pede em uma frase: quem filtra
 * por uma cidade não vê a vaga da outra.
 */
describe("o filtro de cidade separa de verdade", () => {
  it("vaga de Sinop não aparece em outra cidade", async () => {
    const emSinop = await getJobs({ city: "Sinop" });
    expect(emSinop.length).toBeGreaterThan(0);

    const emSorriso = await getJobs({ city: "Sorriso" });
    const idsDeSorriso = new Set(emSorriso.map((j) => j.id));

    expect(emSinop.some((j) => idsDeSorriso.has(j.id))).toBe(false);
    expect(emSorriso.every((j) => j.city === "Sorriso")).toBe(true);
  });

  it("sem filtro de cidade, a busca cobre o estado inteiro", async () => {
    const todas = await getJobs();
    const soSinop = await getJobs({ city: "Sinop" });
    expect(todas.length).toBeGreaterThanOrEqual(soSinop.length);
  });

  it("vale igual para prestador", async () => {
    const emSinop = await getProviders({ city: "Sinop" });
    expect(emSinop.every((p) => p.city === "Sinop")).toBe(true);
    expect(await getProviders({ city: "Cuiabá" })).toEqual([]);
  });
});
