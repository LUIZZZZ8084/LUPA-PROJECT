/**
 * Redes sociais no perfil, com ícone e cor.
 *
 * Era texto cinza sublinhado, do tamanho de qualquer legenda da tela.
 * Reclamação do Luiz em 03/09/2026: perto de quem está decidindo
 * contratar, o link precisa se destacar como botão.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "@/components/social-links";

describe("redes sociais", () => {
  it("sem nenhuma rede preenchida, não desenha nada", () => {
    const { container } = render(<SocialLinks />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra só as redes preenchidas, com o link certo", () => {
    render(<SocialLinks instagram="https://instagram.com/fulano" />);

    const link = screen.getByRole("link", { name: "Instagram" });
    expect(link).toHaveAttribute("href", "https://instagram.com/fulano");
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });

  /** O ícone é decorativo — o texto já diz qual rede é. */
  it("o ícone não polui o leitor de tela", () => {
    render(<SocialLinks instagram="https://instagram.com/fulano" />);
    const svg = screen
      .getByRole("link", { name: "Instagram" })
      .querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden");
  });

  it("abre em aba nova, sem vazar referrer", () => {
    render(<SocialLinks facebook="https://facebook.com/fulano" />);
    const link = screen.getByRole("link", { name: "Facebook" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("site usa ícone genérico, sem cor de marca", () => {
    render(<SocialLinks site="https://exemplo.com" />);
    const link = screen.getByRole("link", { name: "Site" });
    expect(link.className).toContain("text-ink");
  });
});
