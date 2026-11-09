/**
 * @vitest-environment node
 *
 * Buscas que não acharam nada.
 *
 * O teste que mais importa aqui é o do que **não** se guarda. O registro
 * existe para decidir entre ampliar a tabela de sinônimos e partir para
 * busca semântica — e essa decisão não vale o histórico de busca de quem
 * está procurando emprego, que é a mesma classe de informação que o
 * currículo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

// O teto por conta (#585), contado em memória: o banco não existe aqui.
const usos = new Map<string, number>();
vi.mock("@/server/auth/rate-limit", async () => {
  const { erros } = await import("@/server/errors");
  return {
    consumirOrcamento: async (chave: string, o: { chamadas: number }) => {
      const n = (usos.get(chave) ?? 0) + 1;
      usos.set(chave, n);
      if (n > o.chamadas) throw erros.muitasTentativas(60);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => null,
  getCurrentUser: async () => null,
}));

import type { Autenticado } from "@/server/auth/rbac";
import {
  contarBuscaSemResultado,
  RepositorioBuscasMemoria,
  termoParaEstatistica,
  usarRepositorioBuscas,
} from "@/server/buscas";
import { buscasSemResultado } from "@/server/buscas/servico";
import { ehAppError } from "@/server/errors";

const admin: Autenticado = { usuarioId: "admin-1", papel: "admin" };
const empresa: Autenticado = { usuarioId: "empresa-1", papel: "empresa" };
const candidato: Autenticado = { usuarioId: "c-1", papel: "candidato_clt" };

let restaurar: () => void;

beforeEach(() => {
  usos.clear();
  restaurar?.();
  restaurar = usarRepositorioBuscas(new RepositorioBuscasMemoria());
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("o termo, do jeito que vira estatística", () => {
  /*
   * "Eletricista", "eletricista" e "ELETRICISTA" são a mesma pergunta, e
   * só viram sinal quando somam. Sem normalizar, a lista viraria vinte
   * grafias de cinco palavras e não diria nada.
   */
  it("agrupa maiúscula e acento", () => {
    expect(termoParaEstatistica("Eletricista")).toBe("eletricista");
    expect(termoParaEstatistica("MECÂNICO")).toBe(
      termoParaEstatistica("mecanico"),
    );
  });

  it("colapsa espaço, aqui também", () => {
    expect(termoParaEstatistica("  vaga   de   motorista ")).toBe(
      "vaga de motorista",
    );
  });

  /*
   * Uma letra é engano de digitação; duzentos caracteres é alguém colando
   * um texto. Os dois só atrapalhariam quem for ler a lista depois.
   */
  it("descarta o que não vale contar", () => {
    expect(termoParaEstatistica("")).toBeNull();
    expect(termoParaEstatistica("a")).toBeNull();
    expect(termoParaEstatistica("   ")).toBeNull();
    expect(termoParaEstatistica("x".repeat(200))).toBeNull();
  });
});

describe("contagem", () => {
  it("soma o mesmo termo, mesmo escrito diferente", async () => {
    await contarBuscaSemResultado("Eletricista", "servicos", "u-1");
    await contarBuscaSemResultado("eletricista", "servicos", "u-1");
    await contarBuscaSemResultado("ELETRICISTA ", "servicos", "u-1");

    expect(await buscasSemResultado(admin)).toEqual([
      { termo: "eletricista", total: 3 },
    ]);
  });

  it("soma as duas telas no mesmo termo", async () => {
    await contarBuscaSemResultado("pedreiro", "vagas", "u-1");
    await contarBuscaSemResultado("pedreiro", "servicos", "u-1");

    expect(await buscasSemResultado(admin)).toEqual([
      { termo: "pedreiro", total: 2 },
    ]);
  });

  it("do mais buscado para o menos", async () => {
    await contarBuscaSemResultado("soldador", "vagas", "u-1");
    for (let i = 0; i < 3; i++) {
      await contarBuscaSemResultado("costureira", "vagas", "u-1");
    }

    expect((await buscasSemResultado(admin)).map((t) => t.termo)).toEqual([
      "costureira",
      "soldador",
    ]);
  });

  it("busca sem termo não vira linha", async () => {
    await contarBuscaSemResultado(undefined, "vagas", "u-1");
    await contarBuscaSemResultado("", "vagas", "u-1");
    await contarBuscaSemResultado("z", "vagas", "u-1");

    expect(await buscasSemResultado(admin)).toEqual([]);
  });

  /*
   * Quem buscou quer ver a tela, mesmo que a tela diga "nada encontrado".
   * A estatística é para nós.
   */
  it("falha ao contar não estoura para quem buscou", async () => {
    usarRepositorioBuscas({
      registrar: async () => {
        throw new Error("banco fora do ar");
      },
      maisBuscados: async () => [],
    });

    await expect(
      contarBuscaSemResultado("eletricista", "vagas", "u-1"),
    ).resolves.toBeUndefined();
  });
});

/**
 * Teto por conta (#585): passou dele, a busca segue e só deixa de contar.
 * Sem conta não conta — as duas telas pedem login.
 */
describe("teto de registros por conta", () => {
  it("passado o teto, a conta deixa de mexer no ranking", async () => {
    for (let i = 0; i < 40; i++) {
      await contarBuscaSemResultado(`termo inventado ${i}`, "vagas", "u-spam");
    }
    const lista = await buscasSemResultado(admin);
    const total = lista.reduce((s, l) => s + l.total, 0);
    expect(total).toBeLessThanOrEqual(30);
  });

  it("sem conta, não conta", async () => {
    await contarBuscaSemResultado("marceneiro", "vagas", undefined);
    expect(await buscasSemResultado(admin)).toEqual([]);
  });
});

describe("quem lê a lista", () => {
  it("empresa não lê", async () => {
    const erro = await capturar(() => buscasSemResultado(empresa));
    expect(erro.codigo).toBe("sem_permissao");
  });

  it("candidato não lê", async () => {
    const erro = await capturar(() => buscasSemResultado(candidato));
    expect(erro.codigo).toBe("sem_permissao");
  });

  it("sem sessão é 401, não 403", async () => {
    const erro = await capturar(() => buscasSemResultado(null));
    expect(erro.codigo).toBe("nao_autenticado");
  });
});

async function capturar(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (ehAppError(e)) return e;
    throw e;
  }
  throw new Error("esperava um erro, não veio nenhum");
}
