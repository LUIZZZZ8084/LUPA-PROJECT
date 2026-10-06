/**
 * @vitest-environment node
 *
 * Quem pode disparar a varredura de cobranças presas (#358).
 *
 * A rota fica fora do muro de login, porque o cron da Vercel não tem
 * sessão, então o segredo é a única porta. Ela mexe com dinheiro: lê o
 * Mercado Pago e aplica o efeito de pagamentos aprovados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const varredura = vi.hoisted(() => vi.fn());

vi.mock("@/server/pagamentos/servico", () => ({
  reconciliarPagamentosPendentes: varredura,
}));

import { GET } from "@/app/api/cron/reconciliar-pagamentos/route";

function chamar(authorization?: string) {
  return GET(
    new Request("http://localhost/api/cron/reconciliar-pagamentos", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("cron de reconciliação", () => {
  beforeEach(() => {
    varredura.mockReset();
    varredura.mockResolvedValue({ vistas: 0, reconciliadas: 0 });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("CRON_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("com o segredo certo, roda", async () => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
    const r = await chamar("Bearer segredo-do-cron");

    expect(r.status).toBe(200);
    expect(varredura).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["sem cabeçalho", undefined],
    ["segredo errado", "Bearer outro-segredo!"],
    ["tamanho diferente", "Bearer x"],
    ["sem o prefixo", "segredo-do-cron"],
  ])("recusa %s e não varre nada", async (_caso, cabecalho) => {
    vi.stubEnv("CRON_SECRET", "segredo-do-cron");
    const r = await chamar(cabecalho);

    expect(r.status).toBe(401);
    expect(varredura).not.toHaveBeenCalled();
  });

  /**
   * "Fora de produção" não quer dizer "sem dinheiro": um deploy de prévia
   * pode carregar a chave de serviço e o token do Mercado Pago. Qualquer
   * deploy na Vercel sem segredo recusa.
   */
  it.each(["production", "preview", "development"])(
    "na Vercel (%s) sem segredo, recusa com 503 e não varre nada",
    async (ambiente) => {
      vi.stubEnv("VERCEL", "1");
      vi.stubEnv("VERCEL_ENV", ambiente);
      const r = await chamar();

      expect(r.status).toBe(503);
      expect(varredura).not.toHaveBeenCalled();
    },
  );

  it("fora da Vercel e sem segredo, roda solta (dev local e suíte)", async () => {
    const r = await chamar();

    expect(r.status).toBe(200);
    expect(varredura).toHaveBeenCalledTimes(1);
  });
});
