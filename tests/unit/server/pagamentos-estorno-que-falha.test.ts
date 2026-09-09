/**
 * @vitest-environment node
 *
 * O estorno que o Mercado Pago recusa.
 *
 * Este é o caso que decide se a #168 está certa ou perigosa: se a chamada
 * falhou, **o dinheiro não voltou**. Revogar a mensalidade ali tiraria o
 * prestador da vitrine sem devolver nada — o pior dos dois mundos, e do
 * jeito mais difícil de perceber, porque a tela diria que deu certo.
 *
 * Arquivo separado porque `temMercadoPagoConfigurado` é constante calculada
 * na primeira importação: exercitar "com Mercado Pago" e "sem" exige dois
 * módulos, não duas asserções.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: false }));

const revogar = vi.fn(async (_usuarioId: string) => {});
vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: async () => {},
  revogarMensalidade: (...args: [string]) => revogar(...args),
}));

const estado = vi.hoisted(() => ({ recusa: true }));

vi.mock("@/server/pagamentos/mercadopago", async (original) => {
  const real =
    await original<typeof import("@/server/pagamentos/mercadopago")>();
  return {
    ...real,
    temMercadoPagoConfigurado: true,
    estornarPagamento: async () =>
      estado.recusa
        ? { ok: false as const, motivo: "O Mercado Pago recusou o estorno." }
        : { ok: true as const },
  };
});

import type { Autenticado } from "@/server/auth/rbac";
import {
  RepositorioPagamentosMemoria,
  usarRepositorioPagamentos,
} from "@/server/pagamentos";
import { pedirEstorno } from "@/server/pagamentos/servico";

const sessao: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};

describe("estorno recusado pelo Mercado Pago", () => {
  let repo: RepositorioPagamentosMemoria;
  let restaurar: () => void;

  beforeEach(() => {
    repo = new RepositorioPagamentosMemoria();
    restaurar = usarRepositorioPagamentos(repo);
    revogar.mockClear();
    estado.recusa = true;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    restaurar();
    vi.restoreAllMocks();
  });

  async function aprovada() {
    const p = await repo.criar({
      usuarioId: sessao.usuarioId,
      tipo: "prestador_mensalidade",
      valorCentavos: 1990,
    });
    await repo.aprovar(p.id, "mp-123");
    return p;
  }

  it("não revoga a mensalidade quando o estorno falha", async () => {
    const p = await aprovada();

    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(false);
    expect(
      revogar,
      "dinheiro não devolvido não pode tirar ninguém da vitrine",
    ).not.toHaveBeenCalled();
    expect((await repo.porId(p.id))?.status).toBe("aprovado");
  });

  /** A pessoa precisa saber que não deu, para tentar de novo ou pedir ajuda. */
  it("devolve o motivo, em vez de falhar em silêncio", async () => {
    await aprovada();

    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("Mercado Pago");
  });

  /** E, dando certo, o efeito acontece — senão o teste acima passaria à toa. */
  it("com o Mercado Pago aceitando, revoga normalmente", async () => {
    estado.recusa = false;
    const p = await aprovada();

    const r = await pedirEstorno(sessao);

    expect(r.ok).toBe(true);
    expect(revogar).toHaveBeenCalledWith(sessao.usuarioId);
    expect((await repo.porId(p.id))?.status).toBe("estornado");
  });
});
