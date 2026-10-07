/**
 * Os componentes novos da home (#372): o banner e a linha de profissionais.
 *
 * O que se cobra é o que a tela promete e o que ela não pode prometer: o
 * `<h1>` visível, o link de cada profissional, e a ausência de telefone e
 * de qualquer afirmação de disponibilidade, que o app não tem como saber.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  it("há uma foto só, decorativa, e o título não está dentro dela", () => {
    const { container } = render(<BannerDaHome />);

    const fotos = [...container.querySelectorAll("img")];
    expect(fotos).toHaveLength(1);
    expect(fotos[0]).toHaveAttribute("alt", "");
    expect(fotos[0].getAttribute("src")).toContain(
      "trabalhador-recortado.webp",
    );
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  /**
   * O banner tem a mesma forma nos dois temas; só a cor muda (#378). Antes
   * havia uma foto para cada tema, e quem alternava via o banner trocar de
   * composição. Qualquer `dark:` aqui reabriria esse caminho: um elemento
   * que só existe, ou só tem outro tamanho, num dos temas.
   */
  it("nada no banner depende do tema para ter forma", () => {
    const { container } = render(<BannerDaHome />);
    const todas = [...container.querySelectorAll("*")]
      .map((e) => e.getAttribute("class") ?? "")
      .join(" ");

    expect(todas).not.toContain("dark:");
  });

  it("as faixas e o texto pegam a cor das variáveis, e não de uma cor fixa", () => {
    const { container } = render(<BannerDaHome />);
    const faixas = [...container.querySelectorAll("[aria-hidden]")].map(
      (e) => e.className,
    );

    expect(faixas).toHaveLength(2);
    expect(faixas[0]).toContain("var(--banner-faixa-a)");
    expect(faixas[1]).toContain("var(--banner-faixa-b)");
  });

  /**
   * O fundo do banner muda com o tema, então o texto não pode ter cor fixa
   * nem usar `ink` e `muted`, que seguem a página e não o cartão: as cores
   * vêm das variáveis do banner, que trocam junto com o fundo.
   */
  it("o texto usa as variáveis do banner, e não cor fixa nem os tokens da página", () => {
    render(<BannerDaHome />);
    const titulo = screen.getByRole("heading", { level: 1 });
    const frase = screen.getByText(/vagas e profissionais perto de você/i);

    expect(titulo.className).toContain("var(--banner-titulo)");
    expect(frase.className).toContain("var(--banner-texto)");
    expect(titulo.className).not.toMatch(/text-ink|text-\[#/);
    expect(frase.className).not.toMatch(/text-muted|text-\[#/);
  });
});

describe("cores do banner por tema", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const VARIAVEIS = [
    "--banner-de",
    "--banner-ate",
    "--banner-borda",
    "--banner-titulo",
    "--banner-texto",
    "--banner-faixa-a",
    "--banner-faixa-b",
  ];

  it("o claro e o escuro definem as mesmas variáveis", () => {
    const claro = css.match(/:root\s*\{[^}]*--banner-de[^}]*\}/)?.[0] ?? "";
    const escuro =
      css.match(
        /:root\[data-theme="dark"\]\s*\{[^}]*--banner-de[^}]*\}/,
      )?.[0] ?? "";

    for (const v of VARIAVEIS) {
      expect(claro, `claro ${v}`).toContain(`${v}:`);
      expect(escuro, `escuro ${v}`).toContain(`${v}:`);
    }
  });

  /**
   * `dark:` do Tailwind segue, por padrão, a preferência do sistema. Aqui o
   * tema é o atributo do `<html>`, que o botão e o script anti-flash mexem:
   * sem a variante própria, o banner trocaria de foto com o aparelho e não
   * com a escolha da pessoa.
   */
  it("a variante dark segue o atributo data-theme, e não o sistema", () => {
    expect(css).toMatch(/@custom-variant dark \([^)]*data-theme="dark"/);
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
