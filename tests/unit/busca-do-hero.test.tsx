/**
 * A busca do hero e o alternador Vagas/Serviços (#341).
 *
 * O que se cobra aqui é o que o usuário sente quando quebra: a busca chega
 * à lista certa com os filtros preenchidos, a troca entre vagas e serviços
 * não perde o termo nem o lugar, e o visitante sabe que vai entrar.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlternarBusca } from "@/components/alternar-busca";
import { BuscaDoHero } from "@/components/busca-do-hero";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ufs = [
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "SP", nome: "São Paulo" },
];
function hero(props: Partial<Parameters<typeof BuscaDoHero>[0]> = {}) {
  return render(<BuscaDoHero ufs={ufs} visitante={false} {...props} />);
}

describe("BuscaDoHero", () => {
  beforeEach(() => push.mockClear());

  it("busca vagas por padrão, com o termo e o estado na URL", () => {
    hero();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "  auxiliar  " },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "MT" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledWith("/vagas?q=auxiliar&uf=MT");
  });

  it("trocar para Serviços leva a busca para /servicos", () => {
    hero();
    fireEvent.click(screen.getByRole("button", { name: "Serviços" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "diarista" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(push).toHaveBeenCalledWith("/servicos?q=diarista");
  });

  it("não deixa campo vazio na URL", () => {
    hero();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(push).toHaveBeenCalledWith("/vagas");
  });

  /** Ordenar não é filtrar: o estado da conta não vira filtro sem pedir. */
  it("o estado começa em Todo o Brasil", () => {
    hero();
    expect(screen.getByLabelText("Estado")).toHaveValue("");
  });

  it("sem JavaScript, o formulário ainda envia GET para /vagas", () => {
    hero();
    const form = screen.getByRole("searchbox").closest("form");
    expect(form).toHaveAttribute("method", "GET");
    expect(form).toHaveAttribute("action", "/vagas");
  });

  it("o alternador diz qual está ativo e muda o placeholder", () => {
    hero();
    const vagas = screen.getByRole("button", { name: "Vagas" });
    const servicos = screen.getByRole("button", { name: "Serviços" });
    expect(vagas).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      "Cargo ou empresa",
    );

    fireEvent.click(servicos);

    expect(servicos).toHaveAttribute("aria-pressed", "true");
    expect(vagas).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("searchbox")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/eletricista/i),
    );
  });

  /** Saíram do hero a pedido do Luiz (#364): a busca fala por si. */
  it("não traz atalhos de categoria", () => {
    hero();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  /** Aviso antes do clique: a busca de quem não tem conta termina no login. */
  it("visitante é avisado de que entra para ver os resultados", () => {
    hero({ visitante: true });
    expect(screen.getByText(/entre ou crie sua conta/i)).toBeInTheDocument();
  });

  it("quem já entrou não vê o aviso", () => {
    hero({ visitante: false });
    expect(screen.queryByText(/entre ou crie sua conta/i)).toBeNull();
  });

  /** Abaixo de 16 px o Safari do iPhone amplia a página ao focar (#314). */
  it("o campo de busca é de 16 px, e o alternador tem 44 px", () => {
    hero();
    expect(screen.getByRole("searchbox").className).toContain("text-base");
    expect(screen.getByRole("button", { name: "Vagas" }).className).toContain(
      "h-11",
    );
  });
});

describe("AlternarBusca", () => {
  it("marca a busca atual e leva o termo e o lugar para a outra", () => {
    render(
      <AlternarBusca atual="vagas" q="diarista" uf="MT" cidade="Sinop - MT" />,
    );

    expect(screen.getByRole("link", { name: "Vagas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const servicos = screen.getByRole("link", { name: "Serviços" });
    expect(servicos).not.toHaveAttribute("aria-current");

    const url = new URL(servicos.getAttribute("href") ?? "", "http://x");
    expect(url.pathname).toBe("/servicos");
    expect(url.searchParams.get("q")).toBe("diarista");
    expect(url.searchParams.get("uf")).toBe("MT");
    expect(url.searchParams.get("cidade")).toBe("Sinop - MT");
  });

  /** Categoria de vaga não é slug de serviço: levar deixaria a lista vazia. */
  it("não leva categoria nem tipo, que têm vocabulário próprio", () => {
    render(<AlternarBusca atual="servicos" q="x" />);
    const href = screen
      .getByRole("link", { name: "Vagas" })
      .getAttribute("href");
    expect(href).toBe("/vagas?q=x");
  });

  it("sem busca nenhuma, os links são limpos", () => {
    render(<AlternarBusca atual="vagas" />);
    expect(screen.getByRole("link", { name: "Serviços" })).toHaveAttribute(
      "href",
      "/servicos",
    );
  });
});

/**
 * Escolhido o estado, aparece a cidade (#380).
 *
 * As cidades chegam sob demanda, por `import()` dos dados do estado, então
 * estes testes esperam por elas de verdade em vez de simular a lista: o que
 * se cobra é o caminho todo, do estado até a URL.
 */
describe("BuscaDoHero, estado e cidade", () => {
  beforeEach(() => push.mockClear());

  function escolherEstado(sigla: string) {
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: sigla },
    });
  }

  /** O que a busca mandou para a URL, já separado em partes. */
  function ultimaBusca() {
    const alvo = String(push.mock.calls.at(-1)?.[0]);
    const url = new URL(alvo, "http://x");
    return { caminho: url.pathname, params: url.searchParams };
  }

  it("sem estado, não há seletor de cidade", () => {
    hero();
    expect(screen.queryByLabelText("Cidade")).toBeNull();
  });

  it("com estado, a cidade aparece em 'Todas as cidades'", () => {
    hero();
    escolherEstado("MT");

    const cidade = screen.getByLabelText("Cidade");
    expect(cidade).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Todas as cidades" }),
    ).toBeInTheDocument();
  });

  it("as cidades do estado chegam, sem precisar buscar antes", async () => {
    hero();
    escolherEstado("MT");

    expect(await screen.findByRole("option", { name: "Sinop" })).toBeVisible();
    // E só as do estado escolhido: nada de São Paulo na lista de Mato Grosso.
    expect(screen.queryByRole("option", { name: "Campinas" })).toBeNull();
  });

  it("buscar uma cidade leva o estado e a cidade, no formato das listas", async () => {
    hero();
    escolherEstado("MT");
    await screen.findByRole("option", { name: "Sinop" });
    fireEvent.change(screen.getByLabelText("Cidade"), {
      target: { value: "Sinop - MT" },
    });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "diarista" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const { caminho, params } = ultimaBusca();
    expect(caminho).toBe("/vagas");
    expect(params.get("q")).toBe("diarista");
    expect(params.get("uf")).toBe("MT");
    expect(params.get("cidade")).toBe("Sinop - MT");
  });

  it("'Todas as cidades' busca o estado inteiro, sem cidade na URL", () => {
    hero();
    escolherEstado("MT");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const { params } = ultimaBusca();
    expect(params.get("uf")).toBe("MT");
    expect(params.has("cidade")).toBe(false);
  });

  /** Cidade de um estado com outro estado escolhido é um filtro que nunca casa. */
  it("trocar o estado limpa a cidade", async () => {
    hero();
    escolherEstado("MT");
    await screen.findByRole("option", { name: "Sinop" });
    fireEvent.change(screen.getByLabelText("Cidade"), {
      target: { value: "Sinop - MT" },
    });

    escolherEstado("SP");
    expect(screen.getByLabelText("Cidade")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const { params } = ultimaBusca();
    expect(params.get("uf")).toBe("SP");
    expect(params.has("cidade")).toBe(false);
  });

  it("voltar para 'Todo o Brasil' some com a cidade", () => {
    hero();
    escolherEstado("MT");
    expect(screen.getByLabelText("Cidade")).toBeInTheDocument();

    escolherEstado("");
    expect(screen.queryByLabelText("Cidade")).toBeNull();
  });

  /**
   * A ordem do DOM é a ordem de leitura e de foco: termo, estado, cidade,
   * botão. No desktop o botão vai para a direita, e a ordem do DOM não muda.
   */
  it("a ordem dos campos é termo, estado, cidade, botão", () => {
    hero();
    escolherEstado("MT");

    const form = screen.getByRole("searchbox").closest("form");
    const campos = [...(form?.elements ?? [])]
      .filter(
        (e) => e.tagName !== "FIELDSET" && e.getAttribute("type") !== "button",
      )
      .map((e) => e.getAttribute("name") ?? (e as HTMLElement).textContent);

    expect(campos).toEqual(["q", "uf", "cidade", "Buscar"]);
  });

  it("a lista de cidades é marcada como em carregamento até chegar", async () => {
    hero();
    escolherEstado("MT");
    // Carregou: o aria-busy sai quando a lista chega.
    await waitFor(() =>
      expect(screen.getByLabelText("Cidade")).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    );
  });

  it("os campos novos também têm 16 px e 44 px", () => {
    hero();
    escolherEstado("MT");
    const cidade = screen.getByLabelText("Cidade");
    expect(cidade.className).toContain("h-14");
    expect(cidade.className).toContain("text-base");
  });
});

/**
 * Quem escolhe o estado antes de a página terminar de carregar não perde a
 * escolha (#380).
 *
 * O HTML do servidor já traz o seletor, e num celular com rede fraca a pessoa
 * o usa muito antes de o JavaScript chegar. O campo guarda o valor, mas o
 * estado do React ainda é "" — e a cidade não apareceria até ela escolher de
 * novo. Este teste reproduz isso de verdade: renderiza no servidor, muda o
 * campo no HTML antes de hidratar, e hidrata.
 */
describe("BuscaDoHero, hidratação", () => {
  it("o estado escolhido antes de hidratar faz a cidade aparecer", async () => {
    const props = { ufs, visitante: false } as const;
    const container = document.createElement("div");
    container.innerHTML = renderToString(<BuscaDoHero {...props} />);
    document.body.append(container);

    // A pessoa escolhe o estado no HTML do servidor, sem JavaScript ainda.
    const estado =
      container.querySelector<HTMLSelectElement>('select[name="uf"]');
    expect(estado).not.toBeNull();
    expect(container.querySelector('select[name="cidade"]')).toBeNull();
    if (estado) estado.value = "MT";

    await act(async () => {
      hydrateRoot(container, <BuscaDoHero {...props} />);
    });

    expect(container.querySelector('select[name="cidade"]')).not.toBeNull();
    container.remove();
  });
});
