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

  function montarGerenciador(restantes: number, publicar = semEfeito) {
    return render(
      <GerenciarTrabalhos
        restantes={restantes}
        limite={10}
        publicar={publicar}
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

  /**
   * A lista de títulos abaixo da grade desenhava o mesmo item duas vezes, e
   * a segunda vez sem foto. Reclamação do Luiz em 03/09/2026, com print:
   * as ações foram para dentro da foto ampliada, e aqui não sobrou lista.
   */
  it("não desenha lista de títulos, que duplicava a grade", () => {
    montarGerenciador(7);

    expect(screen.queryByText("Quadro de disjuntores trocado")).toBeNull();
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
        restantes={5}
        limite={10}
        publicar={async () => ({ erro: "Escolha uma foto." })}
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
        restantes={5}
        limite={10}
        publicar={async () => ({ ok: true })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /adicionar trabalho/i }),
    );
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(screen.queryByLabelText("Legenda")).toBeNull());
  });
});

/**
 * As ações do dono, dentro da foto ampliada.
 *
 * É para onde elas foram depois que a lista abaixo da grade se mostrou uma
 * duplicata do mesmo item — a segunda vez sem foto. O dono já está olhando
 * para a foto quando decide mexer nela.
 */
describe("ações do dono na foto ampliada", () => {
  const dono = {
    editar: async () => ({}),
    excluir: async () => {},
  };

  function abrirPrimeira(comDono = true) {
    render(
      <AbasDoPerfil
        sobre={<p>Descrição.</p>}
        trabalhos={TRABALHOS}
        vazio="Nada ainda."
        dono={comDono ? dono : undefined}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));
    const painel = document.querySelector("#painel-servicos") as HTMLElement;
    fireEvent.click(within(painel).getAllByRole("button")[0]);
    return screen.getByRole("dialog");
  }

  it("o dono vê editar e remover ao abrir a foto", () => {
    const dialogo = abrirPrimeira();

    expect(
      within(dialogo).getByRole("button", { name: "Editar" }),
    ).toBeTruthy();
    expect(
      within(dialogo).getByRole("button", { name: "Remover" }),
    ).toBeTruthy();
  });

  /** Quem visita vê o trabalho, não os controles de quem o publicou. */
  it("quem não é dono vê só a foto e a legenda", () => {
    const dialogo = abrirPrimeira(false);

    expect(
      within(dialogo).queryByRole("button", { name: "Editar" }),
    ).toBeNull();
    expect(
      within(dialogo).queryByRole("button", { name: "Remover" }),
    ).toBeNull();
    expect(within(dialogo).getByText(/Jardim Botânico/)).toBeTruthy();
  });

  it("editar abre o formulário já preenchido", () => {
    const dialogo = abrirPrimeira();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Editar" }));

    const titulo = screen.getByLabelText(
      "O que é este trabalho",
    ) as HTMLInputElement;
    const legenda = screen.getByLabelText("Legenda") as HTMLTextAreaElement;

    expect(titulo.value).toBe("Quadro de disjuntores trocado");
    expect(legenda.value).toContain("Jardim Botânico");
  });

  /**
   * Trocar a foto é opcional. O motivo comum de abrir isto é arrumar uma
   * palavra da legenda, e reenviar a imagem por causa disso seria caro em
   * dado móvel contado.
   */
  it("o campo de foto diz que dá para manter a atual", () => {
    const dialogo = abrirPrimeira();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Trocar a foto")).toBeTruthy();
    expect(screen.getByText(/manter a que já está aqui/)).toBeTruthy();
  });

  /**
   * "Remover" arquiva, não apaga — e a confirmação diz isso. Sem a frase, a
   * pessoa hesita achando que vai perder o registro de um trabalho que fez.
   */
  it("remover pede confirmação e explica que nada é apagado", () => {
    const dialogo = abrirPrimeira();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Remover" }));

    expect(screen.getByText(/nada é apagado/)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Tirar do perfil/ }),
    ).toBeTruthy();
  });

  /**
   * O card fecha sozinho depois de confirmar.
   *
   * O contador de espaços vem de fora e reage à revalidação; o card
   * ampliado guarda o próprio trabalho num estado do pai que uma
   * revalidação não recalcula. Sem fechar explicitamente depois do
   * `excluir`, o item some da grade por trás e o card fica aberto
   * mostrando um trabalho que já não existe mais na lista — a mesma
   * armadilha de revalidação que este projeto já registrou outras vezes.
   */
  it("fecha o card depois de confirmar a remoção", async () => {
    render(
      <AbasDoPerfil
        sobre={<p>Descrição.</p>}
        trabalhos={TRABALHOS}
        vazio="Nada ainda."
        dono={{ editar: async () => ({}), excluir: async () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Serviços" }));
    const painel = document.querySelector("#painel-servicos") as HTMLElement;
    fireEvent.click(within(painel).getAllByRole("button")[0]);

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    fireEvent.click(screen.getByRole("button", { name: /Tirar do perfil/ }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  /** Escape sai da edição antes de sair do card: o gesto tem dois níveis. */
  it("Escape fecha a edição sem fechar a foto", () => {
    const dialogo = abrirPrimeira();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Editar" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByLabelText("Trocar a foto")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
