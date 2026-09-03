/**
 * A aba Serviços, do jeito que o Luiz desenhou.
 *
 * Aqui, e não no e2e, porque é comportamento de componente: três colunas,
 * troca de aba, e o toque que abre a foto com a legenda. No modo
 * demonstração o prestador criado durante o teste não tem perfil público
 * — a vitrine da demonstração é estática —, então a grade cheia não é
 * alcançável de ponta a ponta sem banco.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AbasDoPerfil, type TrabalhoNaAba } from "@/components/abas-do-perfil";

const TRABALHOS: TrabalhoNaAba[] = [
  {
    id: "1",
    titulo: "Quadro de disjuntores trocado",
    corpo: "Troca completa no Jardim Botânico, com disjuntores DR.",
    imagemUrl: "/foto-1.jpg",
  },
  {
    id: "2",
    titulo: "Chuveiro instalado",
    corpo: "Instalação com fiação nova até o quadro.",
    imagemUrl: "/foto-2.jpg",
  },
  {
    id: "3",
    titulo: "Tomadas do quarto",
    corpo: "Quatro tomadas novas, embutidas.",
    imagemUrl: null,
  },
];

function montar(trabalhos = TRABALHOS) {
  return render(
    <AbasDoPerfil
      sobre={<p>Descrição do profissional.</p>}
      trabalhos={trabalhos}
      vazio="Ainda não publicou trabalhos."
    />,
  );
}

describe("abas do perfil", () => {
  it("abre em Sobre mim — quem é a pessoa vem antes do que ela fez", () => {
    montar();

    expect(screen.getByText("Descrição do profissional.")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sobre mim" }).ariaSelected).toBe(
      "true",
    );
  });

  it("troca para Serviços e mostra as miniaturas", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));

    const painel = document.querySelector("#painel-servicos");
    expect(painel?.hasAttribute("hidden")).toBe(false);
    expect(within(painel as HTMLElement).getAllByRole("listitem")).toHaveLength(
      3,
    );
  });

  /**
   * Três por linha é o desenho, não um detalhe: é a grade de fotos que o
   * público já sabe usar de outros aplicativos.
   */
  it("a grade é de três colunas", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));

    const lista = document.querySelector("#painel-servicos ul");
    expect(lista?.className).toContain("grid-cols-3");
  });

  /**
   * A miniatura mostra que o trabalho existe; a legenda conta o que é.
   * Sem ela a grade vira álbum sem contexto — e o texto é o que diferencia
   * um encanador de outro.
   */
  it("o toque expande a foto com a legenda", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));

    const painel = document.querySelector("#painel-servicos") as HTMLElement;
    fireEvent.click(within(painel).getAllByRole("button")[0]);

    const dialogo = screen.getByRole("dialog");
    expect(
      within(dialogo).getByText("Quadro de disjuntores trocado"),
    ).toBeTruthy();
    expect(within(dialogo).getByText(/Jardim Botânico/)).toBeTruthy();
  });

  it("fecha com Escape", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));
    const painel = document.querySelector("#painel-servicos") as HTMLElement;
    fireEvent.click(within(painel).getAllByRole("button")[0]);

    expect(screen.queryByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  /**
   * Trabalho sem foto ainda aparece, pelo título.
   *
   * O modo demonstração não tem Storage, e o campo de foto é opcional lá.
   * Sumir com o item deixaria a pessoa achando que o trabalho não salvou.
   */
  it("trabalho sem foto aparece pelo título", () => {
    montar();
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));

    expect(screen.getByText("Tomadas do quarto")).toBeTruthy();
  });

  it("sem trabalho nenhum, diz o que fazer em vez de mostrar grade vazia", () => {
    montar([]);
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));

    expect(screen.getByText("Ainda não publicou trabalhos.")).toBeTruthy();
    expect(document.querySelector("#painel-servicos ul")).toBeNull();
  });
});
