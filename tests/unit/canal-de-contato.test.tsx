/**
 * Instagram e e-mail da Lupa, para quem ainda não tem conta (#239).
 *
 * Diferente de `LinksInstitucionais` (Termos/Privacidade/Suporte), isto
 * não depende de `CONTROLADOR` — só um jeito de encontrar a Lupa antes
 * de existir documento legal nenhum.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanalDeContato } from "@/components/canal-de-contato";

describe("canal de contato", () => {
  it("leva ao Instagram certo", () => {
    render(<CanalDeContato />);
    const link = screen.getByRole("link", { name: "Instagram" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/lupapp.br/",
    );
  });

  /**
   * Os dois e-mails têm propósito diferente — confundir os dois faria uma
   * dúvida de uso virar e-mail perdido na caixa errada.
   */
  it("distingue contato de suporte, cada um com o próprio mailto", () => {
    render(<CanalDeContato />);

    const contato = screen.getByRole("link", { name: /fale com a gente/i });
    expect(contato).toHaveAttribute("href", "mailto:contato@lupapp.com.br");

    const suporte = screen.getByRole("link", { name: /suporte/i });
    expect(suporte).toHaveAttribute("href", "mailto:suporte@lupapp.com.br");
  });

  /** O endereço completo não some — fica acessível no title, para quem passar o mouse. */
  it("o endereço completo continua disponível, mesmo com o botão curto", () => {
    render(<CanalDeContato />);
    expect(screen.getByTitle("contato@lupapp.com.br")).toBeTruthy();
    expect(screen.getByTitle("suporte@lupapp.com.br")).toBeTruthy();
  });
});
