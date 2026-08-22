import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LupaLogo, LupaMark } from "@/components/brand/logo";
import { ReviewsPanel } from "@/components/reviews-panel";
import { ratingBreakdown } from "@/lib/data";
import { MOCK_REVIEWS } from "@/lib/mock-data";
import type { Review } from "@/lib/types";

describe("marca", () => {
  it("o símbolo é decorativo e não polui o leitor de tela", () => {
    const { container } = render(<LupaMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden");
  });

  it("o logo mostra o nome e a assinatura opcional", () => {
    render(<LupaLogo tagline="Sinop - MT" />);
    expect(screen.getByText("Lupa")).toBeInTheDocument();
    expect(screen.getByText("Sinop - MT")).toBeInTheDocument();
  });
});

describe("ReviewsPanel", () => {
  const reviews = MOCK_REVIEWS.filter(
    (r) => r.provider_id === "prv-joao-silva",
  );

  it("mostra nota, total e cada comentário", () => {
    render(
      <ReviewsPanel
        reviews={reviews}
        avgRating={4.7}
        reviewCount={reviews.length}
        breakdown={ratingBreakdown(reviews)}
      />,
    );

    expect(screen.getByText("4,7")).toBeInTheDocument();
    expect(
      screen.getByText(`${reviews.length} avaliações`),
    ).toBeInTheDocument();
    expect(screen.getByText(reviews[0].reviewer_name)).toBeInTheDocument();
  });

  it("convida a avaliar quando não há nenhuma", () => {
    render(
      <ReviewsPanel
        reviews={[]}
        avgRating={0}
        reviewCount={0}
        breakdown={ratingBreakdown([])}
      />,
    );
    expect(
      screen.getByText(/ainda não recebeu avaliações/),
    ).toBeInTheDocument();
  });

  it("a barra de cada nota reflete a proporção real", () => {
    const amostra: Review[] = [
      { ...reviews[0], id: "a", rating: 5 },
      { ...reviews[0], id: "b", rating: 5 },
      { ...reviews[0], id: "c", rating: 4 },
      { ...reviews[0], id: "d", rating: 4 },
    ];

    const { container } = render(
      <ReviewsPanel
        reviews={amostra}
        avgRating={4.5}
        reviewCount={4}
        breakdown={ratingBreakdown(amostra)}
      />,
    );

    const larguras = Array.from(
      container.querySelectorAll<HTMLElement>(".bg-vagas"),
    ).map((el) => el.style.width);

    // 2 de 4 em cinco estrelas, 2 de 4 em quatro, nada no resto.
    expect(larguras.slice(0, 4)).toEqual(["50%", "50%", "0%", "0%"]);
  });

  it("comentário vazio não gera parágrafo em branco", () => {
    const semComentario: Review[] = [{ ...reviews[0], id: "x", comment: null }];
    render(
      <ReviewsPanel
        reviews={semComentario}
        avgRating={5}
        reviewCount={1}
        breakdown={ratingBreakdown(semComentario)}
      />,
    );
    expect(
      screen.getByText(semComentario[0].reviewer_name),
    ).toBeInTheDocument();
  });
});

describe("DemoBanner", () => {
  it("aparece e explica o modo demonstração", async () => {
    vi.resetModules();
    vi.doMock("@/lib/demo", () => ({
      isDemoMode: true,
      DEMO_CONTACT_PHONE: null,
      resolveContact: () => ({ phone: null, redirected: true }),
    }));

    const { DemoBanner } = await import("@/components/demo-banner");
    render(<DemoBanner />);

    expect(screen.getByText(/não são ofertas reais/)).toBeInTheDocument();
    expect(screen.getByText(/contato está desativado/)).toBeInTheDocument();
  });

  it("some quando o banco está ligado", async () => {
    vi.resetModules();
    vi.doMock("@/lib/demo", () => ({
      isDemoMode: false,
      DEMO_CONTACT_PHONE: null,
      resolveContact: (p: string) => ({ phone: p, redirected: false }),
    }));

    const { DemoBanner } = await import("@/components/demo-banner");
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("WhatsAppButton", () => {
  it("em demonstração sem número, mostra indisponível em vez de abrir wa.me", async () => {
    vi.resetModules();
    vi.doMock("@/lib/demo", () => ({
      isDemoMode: true,
      DEMO_CONTACT_PHONE: null,
      resolveContact: () => ({ phone: null, redirected: true }),
    }));

    const { WhatsAppButton } = await import("@/components/whatsapp-button");
    render(<WhatsAppButton phone="66999110001" providerName="João Silva" />);

    expect(
      screen.getByText(/Contato indisponível na demonstração/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("com número real, monta o link e identifica a origem na mensagem", async () => {
    vi.resetModules();
    vi.doMock("@/lib/demo", () => ({
      isDemoMode: false,
      DEMO_CONTACT_PHONE: null,
      resolveContact: (p: string) => ({ phone: p, redirected: false }),
    }));

    const { WhatsAppButton } = await import("@/components/whatsapp-button");
    render(
      <WhatsAppButton
        phone="66999110001"
        providerName="João Silva"
        context="Eletricista"
      />,
    );

    const link = screen.getByRole("link");
    const href = decodeURIComponent(link.getAttribute("href") ?? "");
    expect(href).toContain("wa.me/5566999110001");
    expect(href).toContain("João");
    expect(href).toContain("Eletricista");
    expect(href).toContain("Lupa");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("o botão de ícone some quando não há contato disponível", async () => {
    vi.resetModules();
    vi.doMock("@/lib/demo", () => ({
      isDemoMode: true,
      DEMO_CONTACT_PHONE: null,
      resolveContact: () => ({ phone: null, redirected: true }),
    }));

    const { WhatsAppIconButton } = await import("@/components/whatsapp-button");
    const { container } = render(
      <WhatsAppIconButton phone="66999110001" providerName="João Silva" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * O login gravava a sessão e a tela não saía do lugar.
 *
 * A action fazia tudo certo: `criarSessao` gravava o cookie,
 * `revalidatePath` atualizava o layout, e devolvia `{ ok: true, papel }`.
 * O formulário só lia `state.erro` — o `ok` não tinha consumidor. Para
 * quem estava do outro lado, "a caixa de login recarregou". A pessoa
 * estava logada e não sabia.
 *
 * O `papel` era devolvido justamente para escolher o destino, e ficou anos
 * sem uso. Este contrato varre a fonte para que o consumidor não suma de
 * novo numa refatoração.
 */
describe("o formulário de login navega depois de entrar", () => {
  const FONTE = readFileSync(
    join(process.cwd(), "src/app/(auth)/entrar/form.tsx"),
    "utf8",
  );

  it("consome o state.ok, não só o state.erro", () => {
    expect(FONTE).toContain("state.ok");
  });

  it("navega de fato", () => {
    expect(FONTE).toMatch(/router\.(replace|push)\(/);
  });

  it("usa o papel para escolher o destino", () => {
    expect(FONTE).toContain("state.papel");
    expect(FONTE).toContain("/admin/painel");
  });
});
