/**
 * O seletor de arquivo e o que ele mostra do que já existe.
 *
 * Um seletor sozinho não diz o que está gravado hoje. Sem a prévia, a
 * pessoa não tem como perceber que o envio anterior não funcionou — e
 * tenta de novo achando que é a primeira vez.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/perfil/editar/actions", () => ({}));

const { CampoDeArquivo, PreviaDeCurriculo, PreviaDeImagem } = await import(
  "@/app/(app)/perfil/editar/arquivo"
);

const enviar = async () => ({ ok: true });

function montar(disponivel: boolean) {
  render(
    <CampoDeArquivo
      titulo="Foto de perfil"
      descricao="Aparece na busca."
      formatos="JPG, PNG ou WEBP, até 2 MB"
      accept="image/jpeg,image/png,image/webp"
      enviar={enviar}
      remover={async () => {}}
      disponivel={disponivel}
    >
      <PreviaDeImagem url={null} nome="Ana Paula" />
    </CampoDeArquivo>,
  );
}

describe("com armazenamento disponível", () => {
  it("oferece o seletor de arquivo", () => {
    montar(true);
    expect(screen.getByLabelText("Foto de perfil")).toBeTruthy();
  });

  /** O `accept` não é visível; o limite precisa estar escrito. */
  it("diz os formatos e o limite em palavras", () => {
    montar(true);
    expect(screen.getByText(/JPG, PNG ou WEBP, até 2 MB/)).toBeTruthy();
  });

  it("restringe o seletor aos formatos aceitos", () => {
    montar(true);
    expect(screen.getByLabelText("Foto de perfil")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
  });

  it("oferece enviar e remover", () => {
    montar(true);
    expect(screen.getByRole("button", { name: /enviar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /remover/i })).toBeTruthy();
  });
});

describe("sem armazenamento", () => {
  /**
   * Aceitar o envio sem ter onde guardar faria a pessoa achar que salvou.
   * Dizer que não dá é pior de ler e melhor de usar.
   */
  it("não oferece o seletor", () => {
    montar(false);
    expect(screen.queryByLabelText("Foto de perfil")).toBeNull();
  });

  it("explica por que, em vez de só sumir", () => {
    montar(false);
    expect(screen.getByText(/precisa do banco configurado/i)).toBeTruthy();
  });

  /** A prévia continua: saber o que está lá independe de poder trocar. */
  it("ainda mostra o que existe hoje", () => {
    montar(false);
    expect(screen.getByText(/Nenhuma imagem enviada/)).toBeTruthy();
  });
});

describe("prévia de imagem", () => {
  it("sem imagem, diz que não há", () => {
    render(<PreviaDeImagem url={null} nome="Ana Paula" />);
    expect(screen.getByText(/Nenhuma imagem enviada/)).toBeTruthy();
  });

  it("com imagem, mostra a atual", () => {
    render(<PreviaDeImagem url="https://cdn/foto.jpg" nome="Ana Paula" />);
    expect(screen.getByText("Imagem atual")).toBeTruthy();
    expect(screen.getByAltText("Ana Paula")).toHaveAttribute(
      "src",
      "https://cdn/foto.jpg",
    );
  });
});

describe("prévia do currículo", () => {
  it("sem currículo, diz que não há", () => {
    render(<PreviaDeCurriculo link={null} />);
    expect(screen.getByText(/Nenhum currículo enviado/)).toBeTruthy();
  });

  /**
   * O link é assinado e expira em um minuto. Abre em aba nova em vez de
   * virar download porque uma URL que morre não deve ser guardada.
   */
  it("com currículo, abre em aba nova sem vazar a origem", () => {
    render(<PreviaDeCurriculo link="https://cdn/assinada/curriculo.pdf" />);

    const link = screen.getByRole("link", { name: /ver o currículo/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
