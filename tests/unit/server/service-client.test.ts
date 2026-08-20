/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A chave de serviço ignora Row Level Security. Um deslize aqui — o prefixo
 * `NEXT_PUBLIC_` no nome da variável, por exemplo — a embutiria no bundle do
 * navegador e entregaria o banco inteiro a qualquer visitante.
 */
describe("cliente de serviço", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function carregar() {
    vi.resetModules();
    return import("@/lib/supabase/service");
  }

  it("sem chave configurada, devolve null em vez de um cliente quebrado", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { clienteDeServico, temChaveDeServico } = await carregar();

    expect(temChaveDeServico).toBe(false);
    expect(clienteDeServico()).toBeNull();
  });

  it("exige as duas coisas: URL do projeto e chave de serviço", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const { temChaveDeServico } = await carregar();
    expect(temChaveDeServico).toBe(false);
  });

  it("com tudo configurado, devolve um cliente utilizável", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");

    const { clienteDeServico } = await carregar();
    const cliente = clienteDeServico();

    expect(cliente).not.toBeNull();
    expect(typeof cliente?.from).toBe("function");
  });

  it("reaproveita a mesma instância entre chamadas", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");

    const { clienteDeServico } = await carregar();
    expect(clienteDeServico()).toBe(clienteDeServico());
  });

  /**
   * O nome da variável é a proteção. Com prefixo NEXT_PUBLIC_, o Next embute
   * o valor no JavaScript que vai para o navegador.
   */
  it("a chave não é lida de nenhuma variável NEXT_PUBLIC_", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync("src/lib/supabase/service.ts", "utf8");

    expect(fonte).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(fonte).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE/);
    // E o módulo é marcado como exclusivo de servidor.
    expect(fonte).toMatch(/^import "server-only";/m);
  });
});
