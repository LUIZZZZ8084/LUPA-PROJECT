/**
 * @vitest-environment node
 *
 * O termo de busca vem da URL e entrava cru numa string de filtro do
 * PostgREST. A vírgula separa condições nessa linguagem, então quem
 * controlava o termo controlava a lista de condições — o mesmo erro de SQL
 * injection, num dialeto diferente.
 *
 * Não era teórico. Contra o banco de produção, `zzzznaoexiste` devolvia
 * zero resultados e `zzzznaoexiste,full_name.ilike.*a*` devolvia a base
 * inteira.
 *
 * Estes testes capturam o filtro que sai daqui em vez de conferir o
 * resultado da consulta: é o filtro que o atacante manipula, e verificar a
 * contagem de linhas passaria a depender do que existe no banco.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const filtros: string[] = [];

function construtor() {
  const builder: Record<string, unknown> = {
    then: (r: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(r),
  };
  for (const metodo of ["select", "eq", "gte", "order", "limit"]) {
    builder[metodo] = () => builder;
  }
  builder.or = (expressao: string) => {
    filtros.push(expressao);
    return builder;
  };
  return builder;
}

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: true,
  SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_ANON_KEY: "chave",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => construtor() }),
}));

const { getJobs, getProviders } = await import("@/lib/data");

beforeEach(() => {
  filtros.length = 0;
});

/** O que o atacante manda, e o que não pode sobreviver ao escape. */
const ATAQUES = [
  ["vírgula separa condições", "zzzz,full_name.ilike.*a*"],
  ["parêntese agrupa", "zzzz),or(full_name.ilike.*a*"],
  ["aspas fecham o valor", 'zzzz"),or(id.gt."0'],
  ["barra escapa a aspa", 'zzzz\\",or(id.gt.0'],
] as const;

describe("o termo de busca não injeta condição", () => {
  it.each(ATAQUES)("%s", async (_nome, q) => {
    await getProviders({ q });

    const filtro = filtros[0];
    expect(filtro, "nenhum filtro foi montado").toBeTruthy();

    /*
     * O filtro legítimo tem exatamente duas condições, separadas por uma
     * vírgula fora de aspas. Contar as vírgulas de fora é o que distingue
     * "vírgula no termo" de "vírgula que separa condição".
     */
    expect(virgulasForaDeAspas(filtro)).toBe(1);
  });

  it("as duas buscas usam o mesmo escape", async () => {
    await getJobs({ q: "zzzz,title.ilike.*a*" });
    expect(virgulasForaDeAspas(filtros[0])).toBe(1);
  });
});

/**
 * Um teste que nunca viu o defeito não prova nada.
 *
 * Isto monta o filtro do jeito antigo — interpolação crua — e confere que
 * o contador acusa. Se algum dia o escape sumir, o bloco acima falha por
 * este mesmo motivo, e não por acaso.
 */
describe("o contador reconhece o defeito antigo", () => {
  it("interpolação crua deixa a vírgula do atacante separar condição", () => {
    const q = "zzzz,full_name.ilike.*a*";
    const comoEraAntes = `full_name.ilike.%${q}%,description.ilike.%${q}%`;

    expect(virgulasForaDeAspas(comoEraAntes)).toBeGreaterThan(1);
  });

  it("e reconhece o filtro corrigido como uma condição só a mais", () => {
    const seguro =
      'full_name.ilike."%zzzz,full_name.ilike.*a*%",description.ilike."%zzzz,full_name.ilike.*a*%"';

    expect(virgulasForaDeAspas(seguro)).toBe(1);
  });
});

describe("a busca comum continua funcionando", () => {
  it("termo simples vira duas condições ilike", async () => {
    await getProviders({ q: "eletricista" });

    expect(filtros[0]).toBe(
      'full_name.ilike."%eletricista%",description.ilike."%eletricista%"',
    );
  });

  it("acento passa intacto — o público escreve com acento", async () => {
    await getProviders({ q: "Antônio" });
    expect(filtros[0]).toContain("Antônio");
  });

  it("sem termo, nenhum filtro de texto é montado", async () => {
    await getProviders({});
    expect(filtros).toEqual([]);
  });
});

/**
 * Conta vírgulas que estão fora de aspas duplas, respeitando escape por
 * barra. É assim que o PostgREST decide onde uma condição termina.
 */
function virgulasForaDeAspas(filtro: string): number {
  let dentro = false;
  let escapado = false;
  let total = 0;

  for (const c of filtro) {
    if (escapado) {
      escapado = false;
      continue;
    }
    if (c === "\\") {
      escapado = true;
      continue;
    }
    if (c === '"') {
      dentro = !dentro;
      continue;
    }
    if (c === "," && !dentro) total++;
  }

  return total;
}
