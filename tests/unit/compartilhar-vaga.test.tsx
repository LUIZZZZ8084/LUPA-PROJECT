/**
 * Divulgar a vaga: WhatsApp, copiar o link e baixar a arte (#490).
 *
 * O que se prova é o que a empresa leva para fora do app: o texto que abre
 * no WhatsApp, o link que vai para a área de transferência, e o endereço da
 * arte. Os três precisam apontar para a vaga certa, no domínio em que a
 * pessoa está — um link copiado de um preview não pode apontar para
 * produção.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompartilharVaga } from "@/components/compartilhar-vaga";

function montar(props: Partial<Parameters<typeof CompartilharVaga>[0]> = {}) {
  render(
    <CompartilharVaga
      vagaId="vaga-1"
      cargo="Operador de Máquinas"
      cidade="Sinop - MT"
      empresa="Agro Norte"
      {...props}
    />,
  );
}

describe("CompartilharVaga", () => {
  const abrir = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("open", abrir);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    abrir.mockReset();
  });

  it("o WhatsApp abre com a mensagem pronta e o link da vaga", () => {
    montar();

    fireEvent.click(
      screen.getByRole("button", { name: /enviar no whatsapp/i }),
    );

    expect(abrir).toHaveBeenCalledTimes(1);
    const [url, alvo, recursos] = abrir.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const texto = decodeURIComponent(String(url).split("text=")[1]);
    expect(texto).toContain("Operador de Máquinas");
    expect(texto).toContain("Agro Norte");
    expect(texto).toContain("Sinop - MT");
    expect(texto).toContain(`${window.location.origin}/vagas/vaga-1`);
    // Janela nova sem acesso à origem: o WhatsApp não precisa de `opener`.
    expect(alvo).toBe("_blank");
    expect(recursos).toContain("noopener");
  });

  it("sem o nome da empresa, a mensagem não deixa um traço solto", () => {
    montar({ empresa: undefined });

    fireEvent.click(
      screen.getByRole("button", { name: /enviar no whatsapp/i }),
    );

    const texto = decodeURIComponent(
      String(abrir.mock.calls[0][0]).split("text=")[1],
    );
    expect(texto).toContain(
      "Estamos contratando: Operador de Máquinas, Sinop - MT.",
    );
    expect(texto).not.toContain(" — ,");
  });

  it("copiar põe o link da vaga na área de transferência e avisa", async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: escrever } });
    montar();

    fireEvent.click(screen.getByRole("button", { name: /copiar link/i }));

    await waitFor(() =>
      expect(escrever).toHaveBeenCalledWith(
        `${window.location.origin}/vagas/vaga-1`,
      ),
    );
    expect(await screen.findByText("Link copiado")).toBeTruthy();
  });

  /**
   * O navegador embutido de rede social nega a área de transferência. Em vez
   * de um botão que não faz nada, o link aparece para ser copiado à mão.
   */
  it("sem permissão para copiar, mostra o link para copiar à mão", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("negado")) },
    });
    montar();

    fireEvent.click(screen.getByRole("button", { name: /copiar link/i }));

    expect(
      await screen.findByText(`${window.location.origin}/vagas/vaga-1`),
    ).toBeTruthy();
  });

  /**
   * A arte é um `<a download>` comum, e não um `Link` do Next: o `Link`
   * pré-busca o destino, e este endpoint renderiza uma imagem de 1080 × 1920
   * a cada chamada.
   */
  it("a arte é um link de download para o endpoint do dono", () => {
    montar();

    const link = screen.getByRole("link", { name: /baixar arte para story/i });

    expect(link).toHaveAttribute("href", "/api/vagas/vaga-1/arte");
    expect(link).toHaveAttribute("download");
  });

  it("id com caractere especial não quebra o endereço", () => {
    montar({ vagaId: "a/b c" });

    expect(
      screen.getByRole("link", { name: /baixar arte para story/i }),
    ).toHaveAttribute("href", "/api/vagas/a%2Fb%20c/arte");
  });
});
