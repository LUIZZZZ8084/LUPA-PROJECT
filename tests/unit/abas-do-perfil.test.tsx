/**
 * A aba Serviços, do jeito que o Luiz desenhou.
 *
 * Aqui, e não no e2e, porque é comportamento de componente: três colunas,
 * troca de aba, e o toque que abre a foto com a legenda. No modo
 * demonstração o prestador criado durante o teste não tem perfil público
 * — a vitrine da demonstração é estática —, então a grade cheia não é
 * alcançável de ponta a ponta sem banco.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AbasDoPerfil,
  GerenciarTrabalhos,
  type TrabalhoNaAba,
} from "@/components/abas-do-perfil";

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

/**
 * O painel do dono, dentro da aba.
 *
 * É por aqui que a pessoa publica e remove sem sair do perfil. Os estados
 * que importam: o que ela vê antes de abrir o formulário, o que acontece
 * quando o limite acabou, e o que aparece quando o envio falha.
 */
describe("gerenciar trabalhos", () => {
  const semEfeito = async () => ({});
  const removerNada = async () => {};

  function montarGerenciador(
    restantes: number,
    publicar = semEfeito,
    trabalhos = TRABALHOS,
  ) {
    return render(
      <GerenciarTrabalhos
        trabalhos={trabalhos}
        restantes={restantes}
        limite={10}
        publicar={publicar}
        arquivar={removerNada}
      />,
    );
  }

  it("diz quantos espaços sobraram", () => {
    montarGerenciador(7);
    expect(screen.getByText("7 de 10 espaços livres.")).toBeTruthy();
  });

  /**
   * No limite, o botão desabilita e o texto diz o que fazer. Um botão que
   * aceita o clique e recusa depois é a armadilha que este projeto já
   * registrou mais de uma vez.
   */
  it("no limite, não deixa adicionar e explica por quê", () => {
    montarGerenciador(0);

    const botao = screen.getByRole("button", { name: /adicionar trabalho/i });
    expect((botao as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Remova um para publicar outro/)).toBeTruthy();
  });

  it("abre o formulário e dá para desistir", () => {
    montarGerenciador(3);

    fireEvent.click(
      screen.getByRole("button", { name: /adicionar trabalho/i }),
    );
    expect(screen.getByLabelText("O que é este trabalho")).toBeTruthy();
    expect(screen.getByLabelText("Legenda")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Legenda")).toBeNull();
  });

  it("lista o que já existe, com botão de remover nomeado", () => {
    montarGerenciador(7);

    expect(
      screen.getByRole("button", {
        name: "Remover Quadro de disjuntores trocado",
      }),
    ).toBeTruthy();
  });

  it("sem trabalho nenhum, não desenha lista de remoção", () => {
    montarGerenciador(10, semEfeito, []);
    expect(screen.queryByRole("button", { name: /^Remover/ })).toBeNull();
  });
});

/**
 * O envio que falha precisa dizer por quê, sem fechar o formulário.
 *
 * Fechar levaria junto o que a pessoa digitou — e em conexão ruim isso é a
 * diferença entre corrigir e desistir.
 */
describe("gerenciar trabalhos: envio", () => {
  it("mostra o erro e mantém o formulário aberto", async () => {
    render(
      <GerenciarTrabalhos
        trabalhos={[]}
        restantes={5}
        limite={10}
        publicar={async () => ({ erro: "Escolha uma foto." })}
        arquivar={async () => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /adicionar trabalho/i }),
    );
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText("Escolha uma foto.")).toBeTruthy();
    expect(screen.getByLabelText("Legenda")).toBeTruthy();
  });

  /** Deu certo: o formulário fecha sozinho, sem a pessoa ter de fechar. */
  it("no sucesso, fecha o formulário", async () => {
    render(
      <GerenciarTrabalhos
        trabalhos={[]}
        restantes={5}
        limite={10}
        publicar={async () => ({ ok: true })}
        arquivar={async () => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /adicionar trabalho/i }),
    );
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.queryByLabelText("Legenda")).toBeNull());
  });
});
