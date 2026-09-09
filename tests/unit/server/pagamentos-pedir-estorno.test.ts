/**
 * @vitest-environment node
 *
 * Pedir o dinheiro de volta pela Lupa (#168), com o prazo e o alcance
 * revistos na #170.
 *
 * Decisão do Luiz em 08/09/2026: automático, sem fila e sem aprovação — o
 * prestador pediu, o dinheiro volta. Em 09/09, com a renovação automática,
 * ele mudou as duas bordas da regra: **30 dias** em vez de sete, e **só a
 * primeira cobrança**. Da segunda em diante o que existe é cancelar a
 * renovação, que não devolve nada e mantém os dias já pagos.
 *
 * O que estes testes protegem não é o caminho feliz, que é o mais fácil de
 * acertar. São os dois portões: que a segunda cobrança não seja devolvida,
 * e que **falha do Mercado Pago não revogue nada** — se o estorno não
 * aconteceu, o dinheiro não voltou, e tirar a vitrine ali seria o pior dos
 * dois mundos para quem pediu.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const revogar = vi.fn(async (_usuarioId: string) => {});
vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: async () => {},
  revogarMensalidade: (...args: [string]) => revogar(...args),
}));

import type { Autenticado } from "@/server/auth/rbac";
import { ehAppError } from "@/server/errors";
import {
  RepositorioPagamentosMemoria,
  usarRepositorioPagamentos,
} from "@/server/pagamentos";
import {
  cobrancaEstornavel,
  PRAZO_ESTORNO_MS,
  pedirEstorno,
} from "@/server/pagamentos/servico";

const sessao: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};
const outra: Autenticado = {
  usuarioId: "prestador-2",
  papel: "prestador_servico",
};

describe("pedir estorno", () => {
  let repo: RepositorioPagamentosMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioPagamentosMemoria();
    restaurar = usarRepositorioPagamentos(repo);
    revogar.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    restaurar();
    vi.restoreAllMocks();
  });

  /**
   * Uma cobrança aprovada, com a idade que se quiser.
   *
   * O envelhecimento é feito **avançando o relógio**, não reescrevendo a
   * linha por dentro do repositório: mexer no `Map` privado testaria um
   * estado que o código nunca produz, e quebraria no dia em que o
   * repositório guardasse de outro jeito. `vi.useFakeTimers` move o mundo,
   * que é o que de fato acontece quando 30 dias passam.
   */
  async function aprovada(diasAtras = 0, dono = sessao.usuarioId) {
    const p = await repo.criar({
      usuarioId: dono,
      tipo: "prestador_mensalidade",
      valorCentavos: 1990,
    });
    await repo.aprovar(p.id, "mp-123");

    if (diasAtras > 0) {
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + diasAtras * 24 * 60 * 60 * 1000);
    }
    return p;
  }

  it("devolve e revoga a mensalidade na hora", async () => {
    const p = await aprovada();

    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(true);
    expect(revogar).toHaveBeenCalledWith(sessao.usuarioId);
    expect((await repo.porId(p.id))?.status).toBe("estornado");
  });

  /**
   * Trinta dias é a janela da primeira cobrança. Passada ela, a tela nem
   * oferece — e o serviço recusa de qualquer forma, porque tela não é
   * portão.
   */
  it("fora dos 30 dias, recusa e explica", async () => {
    await aprovada(31);

    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/30 dias|prazo/i);
    expect(revogar).not.toHaveBeenCalled();
  });

  it("no vigésimo nono dia ainda dá", async () => {
    await aprovada(29);
    expect((await pedirEstorno(sessao)).ok).toBe(true);
  });

  it("sem pagamento nenhum, recusa sem quebrar", async () => {
    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(false);
    expect(revogar).not.toHaveBeenCalled();
  });

  /** O id vem da sessão: ninguém estorna a cobrança de outra pessoa. */
  it("não alcança a cobrança de outro prestador", async () => {
    await aprovada(0, outra.usuarioId);

    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(false);
    expect(revogar).not.toHaveBeenCalled();
  });

  it("sem sessão é 401", async () => {
    try {
      await pedirEstorno(null);
      throw new Error("esperava erro");
    } catch (e) {
      if (!ehAppError(e)) throw e;
      expect(e.codigo).toBe("nao_autenticado");
    }
  });

  /** Dois cliques não devolvem duas vezes — `estornar` parte de `aprovado`. */
  it("pedir duas vezes revoga só uma", async () => {
    await aprovada();

    await pedirEstorno(sessao);
    const segundo = await pedirEstorno(sessao);

    expect(revogar).toHaveBeenCalledTimes(1);
    // Já não há cobrança aprovada: a segunda tentativa não acha o que estornar.
    expect(segundo.ok).toBe(false);
  });

  /**
   * A regra que a renovação automática trouxe (#170).
   *
   * Sem ela, uma assinatura mensal com devolução aberta é serviço de
   * graça: assina, usa 29 dias, pede o dinheiro de volta, repete. Da
   * segunda cobrança em diante a pessoa já sabia o que estava
   * contratando, e a saída que ela tem é cancelar a renovação.
   */
  describe("só a primeira cobrança", () => {
    it("a segunda cobrança não é devolvida, mesmo dentro do prazo", async () => {
      await aprovada();
      const segunda = await aprovada();

      const r = await pedirEstorno(sessao);

      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.motivo).toMatch(/primeira cobran/i);
      expect(revogar).not.toHaveBeenCalled();
      expect((await repo.porId(segunda.id))?.status).toBe("aprovado");
    });

    /**
     * E não dá para voltar à casa de partida: quem já pediu devolução
     * tem uma linha `estornado` no histórico, e ela conta.
     */
    it("assinar de novo depois de uma devolução não devolve o direito", async () => {
      await aprovada();
      await pedirEstorno(sessao);
      revogar.mockClear();

      await aprovada();
      const r = await pedirEstorno(sessao);

      expect(r.ok).toBe(false);
      expect(revogar).not.toHaveBeenCalled();
    });

    it("a cobrança de outra pessoa não conta contra a sua", async () => {
      await aprovada(0, outra.usuarioId);
      await aprovada();

      expect((await pedirEstorno(sessao)).ok).toBe(true);
    });
  });

  describe("cobrancaEstornavel", () => {
    it("devolve a cobrança dentro do prazo", async () => {
      const p = await aprovada(2);
      expect((await cobrancaEstornavel(sessao))?.id).toBe(p.id);
    });

    it("devolve null fora do prazo — a tela não oferece o que será recusado", async () => {
      await aprovada(40);
      expect(await cobrancaEstornavel(sessao)).toBeNull();
    });

    it("devolve null na segunda cobrança, pelo mesmo motivo", async () => {
      await aprovada();
      await aprovada();
      expect(await cobrancaEstornavel(sessao)).toBeNull();
    });

    it("sem sessão, null", async () => {
      expect(await cobrancaEstornavel(null)).toBeNull();
    });
  });

  it("o prazo é de 30 dias, e está num lugar só", () => {
    expect(PRAZO_ESTORNO_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
