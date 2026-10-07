/**
 * Os componentes novos da home (#372): o banner e a linha de profissionais.
 *
 * O que se cobra é o que a tela promete e o que ela não pode prometer: o
 * `<h1>` visível, o link de cada profissional, e a ausência de telefone e
 * de qualquer afirmação de disponibilidade, que o app não tem como saber.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BannerDaHome } from "@/components/banner-da-home";
import { ProfissionaisEmLinha } from "@/components/profissionais-em-linha";
import { MOCK_PROVIDERS } from "@/lib/mock-data";

describe("BannerDaHome", () => {
  it("tem o único h1, com o convite da home", () => {
    render(<BannerDaHome />);
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo).toHaveTextContent("Encontre seu próximo trabalho");
    expect(
      screen.getByText(/vagas e profissionais perto de você/i),
    ).toBeInTheDocument();
  });

  /**
   * A foto é decorativa e o título é texto: o que a arte original trazia
   * desenhado (título, frase e logo) não pode voltar para dentro da imagem.
   */
  it("a foto é decorativa, e o título não está dentro da imagem", () => {
    const { container } = render(<BannerDaHome />);

    const foto = container.querySelector("img");
    expect(foto).not.toBeNull();
    expect(foto).toHaveAttribute("alt", "");
    expect(foto?.getAttribute("src")).toContain("trabalhador.webp");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  /** O fundo da foto é claro: o texto precisa de cor própria no tema escuro. */
  it("o texto usa cor fixa, e não os tokens que invertem no escuro", () => {
    render(<BannerDaHome />);
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo.className).toMatch(/text-\[#/);
    expect(titulo.className).not.toMatch(/text-ink/);
    expect(
      screen.getByText(/vagas e profissionais perto de você/i).className,
    ).not.toMatch(/text-muted/);
  });
});

describe("ProfissionaisEmLinha", () => {
  const quatro = MOCK_PROVIDERS.slice(0, 4);

  it("cada profissional é um link para o perfil dele", () => {
    render(<ProfissionaisEmLinha providers={quatro} />);
    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(4);
    for (const p of quatro) {
      expect(
        links.some(
          (l) => l.getAttribute("href") === `/servicos/${p.profile_id}`,
        ),
        p.full_name,
      ).toBe(true);
    }
  });

  it("mostra só o primeiro nome e o ofício", () => {
    const [p] = quatro;
    render(<ProfissionaisEmLinha providers={[p]} />);

    const link = screen.getByRole("link");
    expect(within(link).getByText(p.full_name.split(" ")[0])).toBeVisible();
    expect(link).not.toHaveTextContent(p.full_name);
    expect(link).toHaveTextContent(p.category.name);
  });

  /**
   * O que o app não sabe, a tela não diz: nem "disponível", nem "online".
   * E o que não é lido não sai no HTML — telefone e `wa.me` ficam de fora,
   * como o teste do muro de login cobra na home inteira.
   */
  it("não traz telefone, WhatsApp nem promessa de disponibilidade", () => {
    const { container } = render(<ProfissionaisEmLinha providers={quatro} />);
    const html = container.innerHTML;

    expect(html).not.toContain("wa.me");
    for (const p of quatro) expect(html).not.toContain(p.phone);
    expect(html.toLowerCase()).not.toMatch(/dispon[ií]vel|online/);
  });

  it("a nota só aparece quando há avaliação", () => {
    const [p] = quatro;
    const { rerender } = render(
      <ProfissionaisEmLinha
        providers={[{ ...p, review_count: 3, avg_rating: 4.5 }]}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("4,5");

    rerender(
      <ProfissionaisEmLinha
        providers={[{ ...p, review_count: 0, avg_rating: 0 }]}
      />,
    );
    expect(screen.getByRole("link")).not.toHaveTextContent("0,0");
  });

  it("o alvo de toque tem 44 px de altura mínima", () => {
    render(<ProfissionaisEmLinha providers={[quatro[0]]} />);
    expect(screen.getByRole("link").className).toContain("min-h-11");
  });
});
