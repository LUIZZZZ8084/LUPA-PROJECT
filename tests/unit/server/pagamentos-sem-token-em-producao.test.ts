/**
 * @vitest-environment node
 *
 * Banco de verdade e sem token do Mercado Pago: recusa, não libera.
 *
 * O modo demonstração da cobrança nasceu espelhando o do Supabase — sem
 * credencial, aprova na hora. Só que os dois modos de falha não se
 * parecem. Sem Supabase, o app inteiro roda com dados de Sinop e ninguém
 * confunde aquilo com produção. Sem o token do Mercado Pago numa
 * instalação que **tem** Supabase, o que aconteceria é outra coisa: conta
 * real, prestador real, mensalidade aprovada de graça, um `log.info`
 * dizendo "modo demonstração" e nada na tela.
 *
 * "Todo mundo passa" é o pior modo de falha possível numa cobrança, e é
 * silencioso: ninguém abre chamado para reclamar que não foi cobrado.
 *
 * Este arquivo existe separado dos outros de pagamento porque
 * `isSupabaseConfigured` é mockado no nível do módulo, com valor fixo —
 * dois valores diferentes exigem dois arquivos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Autenticado } from "@/server/auth/rbac";

// A diferença deste arquivo para `pagamentos-servico.test.ts`: lá é
// `false`, que é a demonstração legítima.
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

const estenderMensalidadeMock = vi.fn(async (_usuarioId: string) => {});
vi.mock("@/server/prestadores/servico", () => ({
  estenderMensalidade: (...args: [string]) => estenderMensalidadeMock(...args),
}));

const sessao: Autenticado = {
  usuarioId: "prestador-1",
  papel: "prestador_servico",
};

describe("cobrança em produção sem token do Mercado Pago", () => {
  let servico: typeof import("@/server/pagamentos/servico");
  let repo: import("@/server/pagamentos").RepositorioPagamentosMemoria;
  let restaurar: () => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "");
    estenderMensalidadeMock.mockClear();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    servico = await import("@/server/pagamentos/servico");
    const repoModulo = await import("@/server/pagamentos");
    repo = new repoModulo.RepositorioPagamentosMemoria();
    restaurar = repoModulo.usarRepositorioPagamentos(repo);
  });

  afterEach(() => {
    restaurar();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("recusa em vez de aprovar de graça", async () => {
    await expect(
      servico.assinar(sessao, "prestador_mensalidade"),
    ).rejects.toMatchObject({ codigo: "indisponivel" });

    expect(
      estenderMensalidadeMock,
      "o efeito da cobrança não pode ser aplicado sem cobrança",
    ).not.toHaveBeenCalled();
  });

  /**
   * A recusa vem antes de gravar.
   *
   * Recusar depois de `repo.criar` deixaria uma linha `pendente` órfã a
   * cada clique — uma tabela de cobrança enchendo de registros que nunca
   * vão para lugar nenhum, e que na próxima leitura parecem gente que
   * começou a pagar e desistiu.
   */
  it("não deixa cobrança pendente órfã no banco", async () => {
    const criar = vi.spyOn(repo, "criar");

    await expect(
      servico.assinar(sessao, "prestador_mensalidade"),
    ).rejects.toMatchObject({ codigo: "indisponivel" });

    expect(
      criar,
      "a recusa tem de vir antes da gravação",
    ).not.toHaveBeenCalled();
  });
});
