/**
 * O esqueleto de carregamento da home tem a forma da home nova (#376).
 *
 * Ele aparece antes do conteúdo e é trocado por ele. Se as duas formas
 * divergem, a tela "pula" quando os dados chegam, e num celular lento a
 * pessoa já clicou onde o botão estava. As alturas aqui são as medidas no
 * conteúdo carregado; se a home mudar de forma, este teste reprova e lembra
 * de mexer no `loading.tsx`.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "@/app/(app)/(inicio)/loading";

function esqueleto() {
  return render(<Loading />).container;
}

describe("esqueleto da home", () => {
  it("o banner tem a altura do banner: 10 rem no celular e 17 rem em sm", () => {
    const html = esqueleto().innerHTML;
    expect(html).toContain("h-[10rem]");
    expect(html).toContain("sm:h-[17rem]");
  });

  it("o cartão de busca e a faixa de números têm a altura medida", () => {
    const html = esqueleto().innerHTML;
    expect(html).toContain("h-[267px]");
    expect(html).toContain("sm:h-[139px]");
    expect(html).toContain("h-[68px]");
  });

  it("são quatro vagas, em fila no celular e em grade de duas colunas em sm", () => {
    const c = esqueleto();
    const cards = c.querySelectorAll('[class*="min-h-[161px]"]');
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.className).toContain("w-[17rem]");
      expect(card.className).toContain("sm:min-h-[140px]");
    }
    expect(c.querySelector('[class*="sm:grid-cols-2"]')).not.toBeNull();
  });

  it("os profissionais são quatro colunas de avatar com três linhas de texto", () => {
    const c = esqueleto();
    const linha = [...c.querySelectorAll("div")].find((d) =>
      d.className.includes("grid-cols-4"),
    );
    expect(linha).toBeDefined();

    const colunas = linha?.children ?? [];
    expect(colunas).toHaveLength(4);
    for (const coluna of colunas) {
      // avatar redondo + nome + ofício + nota
      expect(coluna.children).toHaveLength(4);
    }
  });

  /** A forma antiga: três cards de ação e cards de profissional com contato. */
  it("não sobrou a forma da home antiga", () => {
    const html = esqueleto().innerHTML;
    // Três cards de ação lado a lado.
    expect(html).not.toContain("sm:grid-cols-3");
    // O círculo do botão de contato do ProviderCard.
    expect(html).not.toContain("self-center rounded-full");
    // O título grande que a home deixou de ter (#364).
    expect(html).not.toContain("sm:h-14");
  });
});
