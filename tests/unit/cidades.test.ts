/**
 * @vitest-environment node
 *
 * O app atende o Brasil inteiro (#301).
 *
 * Começou em Sinop, abriu para Mato Grosso, e agora aceita qualquer
 * município do país. Estes testes cobram as três coisas que fazem isso
 * funcionar: a lista de municípios, a validação que decide quem entra, e
 * o filtro que separa uma cidade — e um estado — do outro.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import { cidadeComUf, nomeDaCidade, UFS, ufDaCidade } from "@/lib/cidades";
import { CARREGADORES } from "@/lib/cidades/indice";
import { cidadesDaUf, ehCidadeValida } from "@/lib/cidades/servidor";
import { CIDADES_POR_UF } from "@/lib/cidades/todas";
import { getJobs, getProviders } from "@/lib/data";

const todas = Object.values(CIDADES_POR_UF).flat();

describe("municípios do Brasil", () => {
  /*
   * Os números são a conferência de que os arquivos gerados não foram
   * truncados. Se o IBGE criar município, estes testes falham e alguém
   * roda `node scripts/gerar-cidades.mjs` — que é exatamente o lembrete
   * que se quer.
   */
  it("são os 5.571 do país, nos 27 estados", () => {
    expect(UFS).toHaveLength(27);
    expect(todas).toHaveLength(5571);
    expect(CIDADES_POR_UF.MT).toHaveLength(142);
  });

  it("não tem nome repetido dentro de um estado, nem em branco", () => {
    for (const [uf, nomes] of Object.entries(CIDADES_POR_UF)) {
      expect(new Set(nomes).size, uf).toBe(nomes.length);
      expect(
        nomes.every((n) => n.trim().length > 1),
        uf,
      ).toBe(true);
    }
  });

  it("cada estado está em ordem alfabética de pt-BR", () => {
    for (const [uf, nomes] of Object.entries(CIDADES_POR_UF)) {
      const ordenada = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
      expect(nomes, uf).toEqual(ordenada);
    }
  });

  it("traz os nomes compostos inteiros, sem cortar no espaço", () => {
    expect(CIDADES_POR_UF.MT).toContain("Vila Bela da Santíssima Trindade");
    expect(CIDADES_POR_UF.SP).toContain("São José do Rio Preto");
    expect(CIDADES_POR_UF.RO).toContain("Alta Floresta D'Oeste");
  });

  /*
   * A razão de a cidade ser gravada com o estado. Se um dia isto voltar
   * a dar zero, o formato pode até ser simplificado — mas não vai.
   */
  it("o nome sozinho não identifica a cidade: vários se repetem", () => {
    const contagem = new Map<string, number>();
    for (const n of todas) contagem.set(n, (contagem.get(n) ?? 0) + 1);
    const repetidos = [...contagem.values()].filter((n) => n > 1);
    expect(repetidos.length).toBeGreaterThan(200);
    expect(contagem.get("Bom Jesus")).toBeGreaterThan(1);
  });
});

/*
 * O celular carrega as cidades de um estado por vez (#301). Cada
 * carregador é um `import()` escrito pelo gerador, e um erro ali — AC
 * apontando para o arquivo de AL — faria quem é do Acre ver as cidades de
 * Alagoas, sem nada quebrar em lugar nenhum.
 */
describe("as cidades sob demanda, estado por estado", () => {
  it("existe um carregador para cada estado, e só para eles", () => {
    expect(Object.keys(CARREGADORES).sort()).toEqual(
      UFS.map((u) => u.sigla).sort(),
    );
    expect(Object.keys(CIDADES_POR_UF).sort()).toEqual(
      UFS.map((u) => u.sigla).sort(),
    );
  });

  it("cada carregador traz exatamente as cidades do próprio estado", async () => {
    for (const { sigla } of UFS) {
      expect(await CARREGADORES[sigla](), sigla).toEqual(CIDADES_POR_UF[sigla]);
    }
  });
});

describe("o formato gravado: 'Cidade - UF'", () => {
  it("monta e desmonta sem perder nada", () => {
    expect(cidadeComUf("Sinop", "MT")).toBe("Sinop - MT");
    expect(ufDaCidade("Sinop - MT")).toBe("MT");
    expect(nomeDaCidade("Sinop - MT")).toBe("Sinop");
  });

  // "Mogi das Cruzes" não tem " - " — mas "Venha-Ver - RN" tem hífen.
  it("o estado é o que vem depois do último ' - '", () => {
    expect(ufDaCidade("Venha-Ver - RN")).toBe("RN");
    expect(nomeDaCidade("Venha-Ver - RN")).toBe("Venha-Ver");
  });

  it("valor sem estado não inventa um", () => {
    expect(ufDaCidade("Sinop")).toBeNull();
    expect(ufDaCidade("Sinop - XX")).toBeNull();
    expect(ufDaCidade(null)).toBeNull();
    expect(nomeDaCidade("Sinop")).toBe("Sinop");
  });

  it("as cidades de um estado já vêm no formato gravado", () => {
    expect(cidadesDaUf("MT")).toContain("Sinop - MT");
    expect(cidadesDaUf("MT")).toHaveLength(142);
  });
});

describe("quem é aceito no cadastro", () => {
  it("qualquer município do Brasil entra, com o estado", () => {
    for (const c of [
      "Sinop - MT",
      "Cuiabá - MT",
      "São Paulo - SP",
      "Porto Alegre - RS",
      "Bom Jesus - PI",
    ]) {
      expect(ehCidadeValida(c), c).toBe(true);
    }
  });

  /*
   * A comparação é exata de propósito. Aceitar "sinop" e "Sinop-MT"
   * pareceria gentileza, mas encheria a base de grafias da mesma cidade
   * — e o filtro de cidade deixaria de agrupar.
   */
  it("variação de grafia não entra", () => {
    for (const c of [
      "sinop - mt",
      "Sinop-MT",
      "Sinop - MT ",
      "SINOP - MT",
      "",
    ]) {
      expect(ehCidadeValida(c), JSON.stringify(c)).toBe(false);
    }
  });

  it("nome sem estado, ou com o estado errado, não entra", () => {
    for (const c of ["Sinop", "Bom Jesus", "Sinop - SP", "Curitiba - MT"]) {
      expect(ehCidadeValida(c), c).toBe(false);
    }
  });
});

/**
 * Quem filtra por uma cidade não vê a vaga da outra (#62), e quem filtra
 * por um estado não vê a vaga de outro (#301).
 */
describe("os filtros de lugar separam de verdade", () => {
  it("vaga de Sinop não aparece em outra cidade", async () => {
    const emSinop = (await getJobs({ city: "Sinop - MT" })).itens;
    expect(emSinop.length).toBeGreaterThan(0);

    const emSorriso = (await getJobs({ city: "Sorriso - MT" })).itens;
    const idsDeSorriso = new Set(emSorriso.map((j) => j.id));

    expect(emSinop.some((j) => idsDeSorriso.has(j.id))).toBe(false);
    expect(emSorriso.every((j) => j.city === "Sorriso - MT")).toBe(true);
  });

  it("o filtro de estado pega todas as cidades dele, e só elas", async () => {
    const emMt = (await getJobs({ uf: "MT" })).itens;
    expect(emMt.length).toBeGreaterThan(0);
    expect(emMt.every((j) => j.city.endsWith(" - MT"))).toBe(true);
    expect((await getJobs({ uf: "SP" })).itens).toEqual([]);
  });

  it("sem filtro de lugar, a busca cobre o país inteiro", async () => {
    const todasAsVagas = (await getJobs()).itens;
    const soSinop = (await getJobs({ city: "Sinop - MT" })).itens;
    expect(todasAsVagas.length).toBeGreaterThanOrEqual(soSinop.length);
  });

  it("vale igual para prestador", async () => {
    const emSinop = (await getProviders({ city: "Sinop - MT" })).itens;
    expect(emSinop.every((p) => p.city === "Sinop - MT")).toBe(true);
    expect((await getProviders({ city: "Cuiabá - MT" })).itens).toEqual([]);
    expect((await getProviders({ uf: "SP" })).itens).toEqual([]);
  });
});

/**
 * A regressão da Issue #76, travada no código-fonte.
 *
 * A tela de busca preenchia a cidade com "Sinop" quando a URL não trazia
 * nenhuma, e a vaga publicada em outra cidade sumia de /vagas enquanto
 * aparecia nos destaques da home. Com o país inteiro aberto, o mesmo vale
 * para o estado: sem nada na URL, a busca é do Brasil.
 *
 * jsdom não carrega rota do App Router, então a trava é sobre o texto do
 * arquivo — mesma escolha do contrato de layout em `cards.test.tsx`.
 */
describe("contrato das telas de busca", () => {
  const telas = [
    "src/app/(app)/vagas/(lista)/page.tsx",
    "src/app/(app)/servicos/(lista)/page.tsx",
  ];

  it.each(telas)("%s não chuta lugar quando a URL não traz um", (tela) => {
    const fonte = readFileSync(tela, "utf8");
    const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

    // A leitura do parâmetro seguida de qualquer valor padrão.
    expect(semComentarios).not.toMatch(
      /single\(\s*["'](cidade|uf)["']\s*\)\s*(\?\?|\|\|)/,
    );
    expect(semComentarios).not.toMatch(/(uf|cidade)\s*(\?\?|\|\|)\s*["']/);
  });
});
