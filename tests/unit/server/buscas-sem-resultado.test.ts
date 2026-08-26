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
    await contarBuscaSemResultado("Eletricista", "servicos");
    await contarBuscaSemResultado("eletricista", "servicos");
    await contarBuscaSemResultado("ELETRICISTA ", "servicos");

    expect(await buscasSemResultado(admin)).toEqual([
      { termo: "eletricista", total: 3 },
    ]);
  });

  it("soma as duas telas no mesmo termo", async () => {
    await contarBuscaSemResultado("pedreiro", "vagas");
    await contarBuscaSemResultado("pedreiro", "servicos");

    expect(await buscasSemResultado(admin)).toEqual([
      { termo: "pedreiro", total: 2 },
    ]);
  });

  it("do mais buscado para o menos", async () => {
    await contarBuscaSemResultado("soldador", "vagas");
    for (let i = 0; i < 3; i++) {
      await contarBuscaSemResultado("costureira", "vagas");
    }

    expect((await buscasSemResultado(admin)).map((t) => t.termo)).toEqual([
      "costureira",
      "soldador",
    ]);
  });

  it("busca sem termo não vira linha", async () => {
    await contarBuscaSemResultado(undefined, "vagas");
    await contarBuscaSemResultado("", "vagas");
    await contarBuscaSemResultado("z", "vagas");

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
      contarBuscaSemResultado("eletricista", "vagas"),
    ).resolves.toBeUndefined();
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
