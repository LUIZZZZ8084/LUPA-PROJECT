import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressoDoPerfil } from "@/components/progresso-do-perfil";
import {
  type CamposDoAnuncio,
  oQueFaltaNoAnuncio,
  progressoDoAnuncio,
} from "@/lib/progresso-do-prestador";

const CHEIO: CamposDoAnuncio = {
  avatarUrl: "/avatares/a.svg",
  descricao: "Instalação elétrica residencial",
  precoInicial: 80,
  anosExperiencia: 0,
  trabalhosAtivos: 1,
};

const VAZIO: CamposDoAnuncio = {
  avatarUrl: null,
  descricao: null,
  precoInicial: null,
  anosExperiencia: null,
  trabalhosAtivos: 0,
};

describe("progressoDoAnuncio (#602)", () => {
  it("anúncio vazio: 0% e as cinco partes, na ordem de quem procura", () => {
    expect(progressoDoAnuncio(VAZIO)).toEqual({
      porcento: 0,
      faltas: [
        { rotulo: "Foto de perfil", onde: "editar" },
        { rotulo: "Descrição do serviço", onde: "editar" },
        { rotulo: "Preço inicial", onde: "editar" },
        { rotulo: "Anos de experiência", onde: "editar" },
        { rotulo: "Foto de um trabalho", onde: "trabalhos" },
      ],
    });
  });

  it("tudo preenchido é 100% — e zero anos de experiência conta como resposta", () => {
    expect(progressoDoAnuncio(CHEIO)).toEqual({ porcento: 100, faltas: [] });
  });

  it("arredonda para baixo, e preço zero ou descrição em branco contam como vazio", () => {
    expect(
      progressoDoAnuncio({ ...CHEIO, precoInicial: 0, descricao: "  " }),
    ).toEqual({
      porcento: 60,
      faltas: [
        { rotulo: "Descrição do serviço", onde: "editar" },
        { rotulo: "Preço inicial", onde: "editar" },
      ],
    });
  });

  it("o trabalho publicado é a única parte que se preenche fora do formulário", () => {
    expect(oQueFaltaNoAnuncio({ ...CHEIO, trabalhosAtivos: 0 })).toEqual([
      { rotulo: "Foto de um trabalho", onde: "trabalhos" },
    ]);
  });
});

describe("ProgressoDoPerfil para o prestador", () => {
  it("fala do anúncio, e o botão leva aonde falta preencher", () => {
    render(
      <ProgressoDoPerfil
        porcento={80}
        faltas={["Foto de um trabalho"]}
        titulo="Seu anúncio"
        motivo="Quem procura serviço chama primeiro o perfil completo."
        href="/perfil/publicacoes"
        tom="servicos"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Seu anúncio está 80% completo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quem procura serviço chama primeiro/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Completar meu perfil" }),
    ).toHaveAttribute("href", "/perfil/publicacoes");
  });
});
