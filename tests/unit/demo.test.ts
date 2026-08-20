import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Proteção de terceiros no modo demonstração.
 *
 * Os prestadores de exemplo têm telefones fictícios mas plausíveis como
 * números de Sinop. Se o app abrir wa.me com um deles, quem realmente tiver
 * aquele número passa a receber mensagem de estranhos. Este teste existe
 * para que isso não volte por descuido.
 */
describe("resolveContact", () => {
  const ambienteOriginal = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ambienteOriginal };
  });

  it("em demonstração sem número configurado, não devolve telefone nenhum", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_LUPA_DEMO_WHATSAPP", "");

    const { resolveContact, isDemoMode } = await import("@/lib/demo");

    expect(isDemoMode).toBe(true);
    const { phone, redirected } = resolveContact("66999110001");
    expect(phone).toBeNull();
    expect(redirected).toBe(true);
  });

  it("em demonstração com número configurado, redireciona para ele", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_LUPA_DEMO_WHATSAPP", "5566988887777");

    const { resolveContact } = await import("@/lib/demo");

    const { phone, redirected } = resolveContact("66999110001");
    expect(phone).toBe("5566988887777");
    expect(redirected).toBe(true);
    // O ponto central: nunca o número do prestador fictício.
    expect(phone).not.toBe("66999110001");
  });

  it("com Supabase configurado, o contato vai para o prestador real", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "chave-anonima");

    const { resolveContact, isDemoMode } = await import("@/lib/demo");

    expect(isDemoMode).toBe(false);
    const { phone, redirected } = resolveContact("66999110001");
    expect(phone).toBe("66999110001");
    expect(redirected).toBe(false);
  });

  it("espaço em branco na variável conta como não configurado", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_LUPA_DEMO_WHATSAPP", "   ");

    const { resolveContact } = await import("@/lib/demo");
    expect(resolveContact("66999110001").phone).toBeNull();
  });
});
