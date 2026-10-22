/**
 * A barra de ação fixa (#479).
 *
 * "Candidatar-se" e "Conversar no WhatsApp" ficavam no fim da página, mais de
 * mil pixels abaixo do topo no celular. A barra prende a ação no pé da janela
 * com `position: sticky`. O CSS não roda no jsdom, então aqui se confere o
 * que a faz funcionar (as classes que prendem, a altura que ela compartilha
 * com a navegação, o aviso de "concluída") e o botão de candidatura que a
 * solta. O comportamento medido no navegador está em
 * `tests/e2e/acao-fixa.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const candidatarSe = vi.fn();
vi.mock("@/app/(app)/vagas/[id]/actions", () => ({
  candidatarSe: (...args: unknown[]) => candidatarSe(...args),
}));

import { ApplyButton } from "@/components/apply-button";
import { BarraDeAcaoFixa } from "@/components/barra-de-acao-fixa";

const lerFonte = (caminho: string) =>
  readFileSync(join(process.cwd(), caminho), "utf8");

beforeEach(() => candidatarSe.mockReset());

describe("BarraDeAcaoFixa", () => {
  function barra() {
    const { container } = render(
      <BarraDeAcaoFixa>
        <button type="button">Agir</button>
      </BarraDeAcaoFixa>,
    );
    return container.firstElementChild as HTMLElement;
  }

  it("mostra o que recebe e se marca para o CSS e para os testes", () => {
    const el = barra();
    expect(screen.getByRole("button", { name: "Agir" })).toBeInTheDocument();
    expect(el).toHaveAttribute("data-barra-de-acao");
  });

  it("prende no pé da janela, acima da navegação inferior e da área segura", () => {
    const { className } = barra();

    expect(className).toContain("sticky");
    expect(className).toContain(
      "bottom-[calc(var(--barra-inferior)+1px+env(safe-area-inset-bottom))]",
    );
  });

  it("de md em diante a navegação some, e a barra vai ao pé da janela como cartão", () => {
    const { className } = barra();

    expect(className).toContain("md:bottom-3");
    expect(className).toContain("md:rounded-2xl");
  });

  it("fica abaixo do cabeçalho e da navegação na pilha de camadas", () => {
    // A navegação é z-40 e o cabeçalho z-30; a barra é z-20 e nunca os cobre.
    expect(barra().className).toContain("z-20");
  });

  it("solta (vira bloco comum) quando algum filho avisa que a ação terminou", () => {
    expect(barra().className).toContain("has-[[data-acao-concluida]]:static");
  });
});

describe("a altura da navegação inferior é uma só", () => {
  it("o token existe no CSS e a navegação o usa como altura", () => {
    const css = lerFonte("src/app/globals.css");
    expect(css).toMatch(/:root\s*\{\s*--barra-inferior:\s*3\.75rem;/);

    const nav = lerFonte("src/components/layout/bottom-nav.tsx");
    expect(nav).toContain("h-[var(--barra-inferior)]");
  });
});

describe("ApplyButton e a barra", () => {
  it("antes de candidatar-se não avisa que terminou", () => {
    const { container } = render(<ApplyButton jobId="job-1" />);

    expect(
      screen.getByRole("button", { name: /Candidatar-se/ }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-acao-concluida]")).toBeNull();
  });

  it("depois de enviada, avisa a barra para soltar", async () => {
    candidatarSe.mockResolvedValue({ ok: true });
    const { container } = render(<ApplyButton jobId="job-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Candidatar-se/ }));

    await waitFor(() =>
      expect(screen.getByText("Candidatura enviada")).toBeInTheDocument(),
    );
    expect(container.querySelector("[data-acao-concluida]")).not.toBeNull();
  });

  it("se a candidatura falha, a ação não terminou: a barra continua presa", async () => {
    candidatarSe.mockResolvedValue({ ok: false, mensagem: "Sem vaga." });
    const { container } = render(<ApplyButton jobId="job-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Candidatar-se/ }));

    await waitFor(() =>
      expect(screen.getByText("Sem vaga.")).toBeInTheDocument(),
    );
    expect(container.querySelector("[data-acao-concluida]")).toBeNull();
  });
});
