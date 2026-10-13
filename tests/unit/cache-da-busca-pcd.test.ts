/**
 * @vitest-environment node
 *
 * O filtro de PCD entra na chave do cache da listagem de vagas (#456).
 *
 * A chave carrega os filtros e nada de quem pergunta. Um filtro que ficasse
 * de fora serviria a lista de todas as vagas a quem pediu só as de PCD —
 * pelo cache, sem erro nenhum e sem nada ficar vermelho.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const chaves: string[][] = [];

vi.mock("@/lib/cache-de-listagem", () => ({
  TAG_VAGAS: "vagas",
  TAG_PRESTADORES: "prestadores",
  emCache: async (ler: () => Promise<unknown>, chave: string[]) => {
    chaves.push(chave);
    return ler();
  },
}));

function construtor() {
  const b: Record<string, unknown> = {
    then: (r: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(r),
  };
  for (const m of [
    "select",
    "eq",
    "gt",
    "gte",
    "order",
    "limit",
    "or",
    "like",
  ]) {
    b[m] = () => b;
  }
  return b;
}

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: true,
  SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_ANON_KEY: "chave",
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => construtor() }),
}));
vi.mock("@/lib/supabase/publico", () => ({
  clientePublico: () => ({ from: () => construtor() }),
}));

const { getJobs } = await import("@/lib/data");

beforeEach(() => {
  chaves.length = 0;
});

describe("chave do cache das vagas", () => {
  it("muda quando o filtro de PCD é pedido", async () => {
    await getJobs({});
    await getJobs({ pcd: true });

    expect(chaves).toHaveLength(2);
    expect(chaves[0]).not.toEqual(chaves[1]);
  });

  it("não muda por pedir 'todas' explicitamente", async () => {
    await getJobs({});
    await getJobs({ pcd: false });

    expect(chaves[0]).toEqual(chaves[1]);
  });

  it("continua sem nada de quem pergunta", async () => {
    await getJobs({ pcd: true });
    expect(chaves[0].join("|")).not.toMatch(/perto|sessao|usuario/i);
  });
});
