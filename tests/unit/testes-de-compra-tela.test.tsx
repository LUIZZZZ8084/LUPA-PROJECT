/**
 * A tela de testes de compra do admin (#516).
 *
 * A suíte e2e não tem sessão de admin, então é aqui que a tela é desenhada:
 * os cinco produtos com o preço que a pessoa pagaria, o tipo certo chegando
 * à action, e o resultado — o PDF ou a carteira — dito na tela.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRECO_CENTAVOS } from "@/server/pagamentos/planos";

const chamadas = vi.hoisted(() => ({
  tipos: [] as string[],
  resposta: null as unknown,
}));

vi.mock("@/app/(app)/admin/actions", () => ({
  testarCompraAction: async ({ tipo }: { tipo: string }) => {
    chamadas.tipos.push(tipo);
    return chamadas.resposta;
  },
}));

const { TestesDeCompra } = await import(
  "@/app/(app)/admin/testes/testes-cliente"
);

const carteira = {
  pode: true,
  mensalAtivo: true,
  limiteNoAr: 5,
  noAr: 0,
  planoCheio: false,
  creditos: 2,
  mensalidadeValidaAte: "2026-11-27T12:00:00.000Z",
  primeiraGratis: false,
};

beforeEach(() => {
  chamadas.tipos = [];
  chamadas.resposta = null;
});

describe("tela de testes de compra", () => {
  it("mostra os cinco produtos com o preço de verdade, e diz que não entra no caixa", () => {
    render(<TestesDeCompra precos={PRECO_CENTAVOS} />);

    for (const titulo of [
      "Gerador de currículo",
      "1 vaga avulsa",
      "Plano 5 vagas",
      "Plano 10 vagas",
      "Plano ilimitado",
    ]) {
      expect(screen.getByRole("heading", { name: titulo })).toBeTruthy();
    }
    // O Intl separa "R$" do número com espaço inquebrável.
    expect(screen.getByText(/R\$\s14,90/)).toBeTruthy();
    expect(screen.getByText(/R\$\s99,90/)).toBeTruthy();
    // Cada botão diz de qual produto é, para o leitor de tela (#523).
    const nomes = screen
      .getAllByRole("button", { name: /^Comprar sem pagar: / })
      .map((b) => b.getAttribute("aria-label"));
    expect(new Set(nomes).size).toBe(5);
    expect(screen.getByText("Não entra no caixa")).toBeTruthy();
  });

  it("o currículo manda o tipo certo e confirma o PDF gerado", async () => {
    // "%PDF-" em base64: o que a action devolve de verdade é um PDF.
    chamadas.resposta = {
      ok: true,
      dados: { tipo: "curriculo_pdf", pdfBase64: "JVBERi0=", carteira: null },
    };
    const baixou = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const criarUrl = URL.createObjectURL;
    URL.createObjectURL = () => "blob:curriculo";
    render(<TestesDeCompra precos={PRECO_CENTAVOS} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /^Comprar sem pagar: / })[0],
    );

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(
        /Gerador liberado/,
      ),
    );
    expect(chamadas.tipos).toEqual(["curriculo_pdf"]);
    // O download começa sozinho, e o link fica para baixar de novo.
    expect(baixou).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "Baixar de novo" }).getAttribute("href"),
    ).toBe("blob:curriculo");
    baixou.mockRestore();
    URL.createObjectURL = criarUrl;
  });

  it("a compra de vaga mostra como a carteira ficou", async () => {
    chamadas.resposta = {
      ok: true,
      dados: { tipo: "empresa_plano_5", pdfBase64: null, carteira },
    };
    render(<TestesDeCompra precos={PRECO_CENTAVOS} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /^Comprar sem pagar: / })[2],
    );

    const status = await screen.findByRole("status");
    expect(chamadas.tipos).toEqual(["empresa_plano_5"]);
    expect(status.textContent).toMatch(/Créditos de vaga:\s*2/);
    expect(status.textContent).toMatch(/até 5 vagas no ar/);
    expect(
      screen
        .getByRole("link", { name: "Ver na área de contratação" })
        .getAttribute("href"),
    ).toBe("/empresa/creditos");
  });

  it("a recusa do servidor aparece na linha do produto", async () => {
    chamadas.resposta = {
      ok: false,
      codigo: "sem_permissao",
      mensagem: "Você não tem permissão para isso.",
      id: "x",
    };
    render(<TestesDeCompra precos={PRECO_CENTAVOS} />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /^Comprar sem pagar: / })[1],
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Você não tem permissão para isso.",
    );
  });
});
