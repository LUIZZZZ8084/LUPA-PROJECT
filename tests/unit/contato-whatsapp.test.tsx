/**
 * O botão de contato é o caminho principal do produto: não há chat interno,
 * a conversa acontece no `wa.me`. Também é onde um erro alcança gente de
 * fora da plataforma.
 *
 * Aconteceu: com o Supabase ligado, o botão passou a montar `wa.me` com o
 * telefone do perfil, e os perfis de exemplo tinham números fictícios porém
 * plausíveis. Quem tivesse aquele número em Sinop receberia mensagem de
 * desconhecido procurando eletricista.
 *
 * A salvaguarda que existia dependia do modo demonstração — e ligar o banco
 * a desarmava justamente quando ela passava a importar.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockDemo = vi.hoisted(() => ({
  isDemoMode: false,
  DEMO_CONTACT_PHONE: null as string | null,
  resolveContact: (telefone: string) => ({
    phone: telefone as string | null,
    redirected: false,
  }),
}));

vi.mock("@/lib/demo", () => mockDemo);

const { WhatsAppButton, WhatsAppIconButton } = await import(
  "@/components/whatsapp-button"
);

function comContato(phone: string | null, redirected: boolean) {
  mockDemo.resolveContact = () => ({ phone, redirected });
}

afterEach(() => {
  comContato("66000000001", false);
});

describe("botão de contato", () => {
  it("aponta para o telefone resolvido, com o 55 na frente", () => {
    comContato("66000000001", false);
    render(<WhatsAppButton phone="66000000001" providerName="João Silva" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/5566000000001"),
    );
  });

  /**
   * Sem número resolvido, abrir `wa.me` levaria a um número inventado que
   * pode ser de alguém. O botão precisa ficar inerte e dizer por quê.
   */
  it("sem número, não vira link — fica desativado e explica", () => {
    comContato(null, true);
    render(<WhatsAppButton phone="66000000001" providerName="João Silva" />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/indisponível na demonstração/i)).toBeTruthy();
  });

  it("a versão de ícone some por completo sem número", () => {
    comContato(null, true);
    const { container } = render(
      <WhatsAppIconButton phone="66000000001" providerName="João Silva" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("redirecionado, a mensagem diz que veio da demonstração", () => {
    comContato("66999999999", true);
    render(
      <WhatsAppButton
        phone="66000000001"
        providerName="João Silva"
        context="Eletricista"
      />,
    );

    const href = screen.getByRole("link").getAttribute("href") ?? "";
    expect(decodeURIComponent(href)).toContain("demonstração");
    expect(href).toContain("wa.me/5566999999999");
  });

  it("direto, a mensagem trata o prestador pelo primeiro nome", () => {
    comContato("66000000001", false);
    render(
      <WhatsAppButton
        phone="66000000001"
        providerName="João Silva"
        context="Eletricista"
      />,
    );

    const href = decodeURIComponent(
      screen.getByRole("link").getAttribute("href") ?? "",
    );
    expect(href).toContain("Olá, João!");
    expect(href).toContain("Eletricista");
  });

  it("sem contexto, a mensagem não fica com parênteses vazios", () => {
    comContato("66000000001", false);
    render(<WhatsAppButton phone="66000000001" providerName="Rosa Mendes" />);

    const href = decodeURIComponent(
      screen.getByRole("link").getAttribute("href") ?? "",
    );
    expect(href).not.toContain("()");
    expect(href).not.toContain("de .");
  });

  it("abre em aba nova sem vazar a origem", () => {
    comContato("66000000001", false);
    render(<WhatsAppButton phone="66000000001" providerName="João Silva" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
