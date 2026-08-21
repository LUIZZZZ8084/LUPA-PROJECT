/**
 * O aviso de demonstração é o que impede alguém em Sinop de perseguir uma
 * vaga que não existe. Some sozinho quando o banco está ligado — e essa
 * transição já enganou: com as variáveis presentes mas a consulta falhando,
 * a tela servia dado de exemplo sem o aviso.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockDemo = vi.hoisted(() => ({
  isDemoMode: true,
  DEMO_CONTACT_PHONE: null as string | null,
  resolveContact: () => ({ phone: null, redirected: true }),
}));

vi.mock("@/lib/demo", () => mockDemo);

const { DemoBanner } = await import("@/components/demo-banner");

describe("aviso de demonstração", () => {
  it("com banco ligado, não aparece", () => {
    mockDemo.isDemoMode = false;
    const { container } = render(<DemoBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("em demonstração, diz que os perfis são exemplos", () => {
    mockDemo.isDemoMode = true;
    mockDemo.DEMO_CONTACT_PHONE = null;
    render(<DemoBanner />);

    expect(screen.getByText(/Demonstração/)).toBeTruthy();
    expect(screen.getByText(/não são ofertas reais/)).toBeTruthy();
  });

  /** Os dois estados do contato precisam ser ditos, não deduzidos. */
  it("sem número configurado, avisa que o contato está desativado", () => {
    mockDemo.isDemoMode = true;
    mockDemo.DEMO_CONTACT_PHONE = null;
    render(<DemoBanner />);
    expect(screen.getByText(/contato está desativado/)).toBeTruthy();
  });

  it("com número configurado, avisa que o contato vai para a equipe", () => {
    mockDemo.isDemoMode = true;
    mockDemo.DEMO_CONTACT_PHONE = "66999999999";
    render(<DemoBanner />);
    expect(screen.getByText(/leva à equipe da Lupa/)).toBeTruthy();
  });
});
