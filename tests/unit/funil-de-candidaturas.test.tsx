/**
 * A área de contratação como mini CRM (#511): as contas do painel, o funil
 * em colunas e as abas.
 *
 * O e2e confere o caminho no navegador (`triagem-da-vaga`, `ficha-do-
 * candidato`, `encerrar-vaga`); aqui se prova o que ele não alcança bem: o
 * card que volta para a coluna de antes quando o servidor recusa, o arrastar,
 * a coluna do celular, e as contas que viram números na tela.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  alcancePorEtapa,
  contarPorEstagio,
  ehEstagio,
  vagasVencendo,
} from "@/lib/funil-de-candidaturas";

const estado = vi.hoisted(() => ({
  caminho: "/empresa/funil",
  movidas: [] as unknown[],
  resposta: { ok: true, dados: {} } as
    | { ok: true; dados: object }
    | { ok: false; mensagem: string },
  substituida: null as string | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => estado.caminho,
  useRouter: () => ({
    replace: (url: string) => {
      estado.substituida = url;
    },
  }),
}));
vi.mock("@/app/(app)/_contratacao/actions", () => ({
  moverCandidatura: async (dados: unknown) => {
    estado.movidas.push(dados);
    return estado.resposta;
  },
}));

const { QuadroDoFunil } = await import(
  "@/app/(app)/_contratacao/quadro-do-funil"
);
const { AbasDaContratacao } = await import("@/app/(app)/_contratacao/abas");
const { AREA_EMPRESA, AREA_PRESTADOR } = await import(
  "@/app/(app)/_contratacao/area"
);

type Card = Parameters<typeof QuadroDoFunil>[0]["cards"][number];

const card = (parcial: Partial<Card> & Pick<Card, "id" | "nome">): Card => ({
  avatar: null,
  vagaId: "v1",
  vaga: "Motorista de carreta",
  status: "enviada",
  ha: "há 2 h",
  match: null,
  motivos: [],
  whatsapp: null,
  ...parcial,
});

const CARDS: Card[] = [
  card({
    id: "a",
    nome: "Everton Rodrigues",
    match: { porcentagem: 82, pontos: 4, deQuantas: 5 },
  }),
  card({ id: "b", nome: "Joana Souza", motivos: ["Tem CNH E?"] }),
  card({
    id: "c",
    nome: "Ana Lima",
    status: "entrevista",
    whatsapp: "https://wa.me/5566999990000?text=oi",
  }),
];

function montar(cards = CARDS) {
  return render(
    <QuadroDoFunil
      cards={cards}
      base="/empresa"
      vagas={[{ id: "v1", titulo: "Motorista de carreta" }]}
      vagaEscolhida={null}
      estagioInicial="enviada"
    />,
  );
}

const coluna = (nome: RegExp) => screen.getByRole("region", { name: nome });

beforeEach(() => {
  estado.caminho = "/empresa/funil";
  estado.movidas = [];
  estado.resposta = { ok: true, dados: {} };
  estado.substituida = null;
});

describe("contas do funil", () => {
  it("conta cada estágio, com zero nos vazios", () => {
    expect(
      contarPorEstagio([
        { status: "enviada" },
        { status: "enviada" },
        { status: "aprovada" },
      ]),
    ).toEqual({
      enviada: 2,
      visualizada: 0,
      entrevista: 0,
      aprovada: 1,
      rejeitada: 0,
    });
  });

  /**
   * Quem foi selecionado passou pela entrevista, mesmo que a empresa tenha
   * pulado o estágio: o funil conta até onde cada um chegou.
   */
  it("o alcance conta quem passou por cada etapa, não só quem está nela", () => {
    expect(
      alcancePorEtapa({
        enviada: 3,
        visualizada: 2,
        entrevista: 1,
        aprovada: 1,
        rejeitada: 3,
      }),
    ).toEqual({ recebidas: 10, olhadas: 7, entrevistas: 2, selecionados: 1 });
  });

  it("vagas vencendo: só as abertas, no prazo, que saem em até 3 dias", () => {
    const agora = new Date("2026-10-27T12:00:00Z");
    const daqui = (dias: number) =>
      new Date(agora.getTime() + dias * 86_400_000).toISOString();
    const vencendo = vagasVencendo(
      [
        { id: "1", status: "aberta", expires_at: daqui(2) },
        { id: "2", status: "aberta", expires_at: daqui(10) },
        { id: "3", status: "fechada", expires_at: daqui(1) },
        { id: "4", status: "aberta", expires_at: daqui(-1) },
      ],
      3,
      agora,
    );
    expect(vencendo.map((v) => v.id)).toEqual(["1"]);
  });

  it("estágio só vale se for um dos cinco", () => {
    expect(ehEstagio("entrevista")).toBe(true);
    expect(ehEstagio("contratado")).toBe(false);
    expect(ehEstagio(undefined)).toBe(false);
  });
});

describe("quadro do funil", () => {
  it("cada card na coluna do estágio dele, com a contagem no título", () => {
    montar();

    expect(
      within(coluna(/^Nova: 2$/)).getByText("Everton Rodrigues"),
    ).toBeTruthy();
    expect(
      within(coluna(/^Entrevista: 1$/)).getByText("Ana Lima"),
    ).toBeTruthy();
    expect(
      within(coluna(/^Selecionado: 0$/)).getByText(/ninguém neste estágio/i),
    ).toBeTruthy();
  });

  it("o nome abre a ficha, e o selo e o WhatsApp vêm no card", () => {
    montar();

    expect(
      screen.getByRole("link", { name: /Everton Rodrigues/ }),
    ).toHaveAttribute("href", "/empresa/candidaturas/a");
    expect(
      screen.getByLabelText(/Combina com 4 de 5 habilidades/),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Chamar Ana Lima no WhatsApp" }),
    ).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  /** Separa e não esconde (#491): o motivo vem no card, depois de quem atende. */
  it("quem não respondeu o que a vaga exigia fica à parte, com o motivo", () => {
    montar();
    const nova = coluna(/^Nova/);

    const separador = within(nova).getByText(
      "Não responderam o que a vaga exigia (1)",
    );
    const ordem = [...nova.querySelectorAll("li")].map((li) => li.textContent);
    const iSeparador = ordem.findIndex((t) => t?.startsWith("Não responderam"));
    expect(separador).toBeTruthy();
    expect(ordem.findIndex((t) => t?.includes("Everton"))).toBeLessThan(
      iSeparador,
    );
    expect(ordem.findIndex((t) => t?.includes("Joana"))).toBeGreaterThan(
      iSeparador,
    );
    expect(within(nova).getByText("Respondeu Não: Tem CNH E?")).toBeTruthy();
  });

  it("o seletor do card move para a outra coluna na hora, e chama a action", async () => {
    montar();

    fireEvent.change(
      screen.getByLabelText("Estágio da candidatura de Everton Rodrigues"),
      {
        target: { value: "entrevista" },
      },
    );

    expect(
      within(coluna(/^Entrevista: 2$/)).getByText("Everton Rodrigues"),
    ).toBeTruthy();
    await waitFor(() =>
      expect(estado.movidas).toEqual([{ id: "a", status: "entrevista" }]),
    );
  });

  it("se o servidor recusar, o card volta e o motivo aparece nele", async () => {
    estado.resposta = { ok: false, mensagem: "Candidatura não encontrada." };
    montar();

    fireEvent.change(
      screen.getByLabelText("Estágio da candidatura de Everton Rodrigues"),
      {
        target: { value: "aprovada" },
      },
    );

    await waitFor(() =>
      expect(
        within(coluna(/^Nova/)).getByText("Everton Rodrigues"),
      ).toBeTruthy(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Candidatura não encontrada.",
    );
  });

  it("arrastar o card e soltar noutra coluna move do mesmo jeito", async () => {
    montar();
    const dados = new Map<string, string>();
    const transferencia = {
      setData: (t: string, v: string) => dados.set(t, v),
      getData: (t: string) => dados.get(t) ?? "",
      effectAllowed: "",
    };

    const everton = screen.getByText("Everton Rodrigues").closest("li");
    fireEvent.dragStart(everton as HTMLElement, {
      dataTransfer: transferencia,
    });
    fireEvent.dragOver(coluna(/^Selecionado/), { dataTransfer: transferencia });
    fireEvent.drop(coluna(/^Selecionado/), { dataTransfer: transferencia });

    expect(
      within(coluna(/^Selecionado: 1$/)).getByText("Everton Rodrigues"),
    ).toBeTruthy();
    await waitFor(() =>
      expect(estado.movidas).toEqual([{ id: "a", status: "aprovada" }]),
    );
  });

  /**
   * No celular, uma coluna por vez. As outras ficam escondidas por classe
   * (`hidden`), e só aparecem lado a lado do `md` para cima.
   */
  it("no celular, os botões de estágio escolhem a coluna que aparece", () => {
    montar();
    const entrevista = coluna(/^Entrevista/);
    expect(entrevista.className).toMatch(/(^|\s)hidden(\s|$)/);

    fireEvent.click(screen.getByRole("button", { name: /Entrevista\s*1/ }));

    expect(entrevista.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(coluna(/^Nova/).className).toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("o filtro de vaga troca o endereço, para a vaga ficar no link", () => {
    montar();

    fireEvent.change(screen.getByLabelText("Vaga"), {
      target: { value: "v1" },
    });

    expect(estado.substituida).toBe("/empresa/funil?vaga=v1");
  });
});

describe("abas da contratação", () => {
  it("as quatro abas de cada porta, e a da página atual marcada", () => {
    estado.caminho = "/contratar/funil";
    render(<AbasDaContratacao area={AREA_PRESTADOR} />);

    const abas = screen.getAllByRole("link");
    expect(abas.map((a) => a.getAttribute("href"))).toEqual([
      "/contratar",
      "/contratar/vagas",
      "/contratar/funil",
      "/contratar/talentos",
    ]);
    expect(screen.getByRole("link", { name: "Candidatos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Painel" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  /** Planos é página à parte, com o caminho de volta ao painel (#515). */
  it("planos não é aba", () => {
    estado.caminho = "/empresa";
    render(<AbasDaContratacao area={AREA_EMPRESA} />);

    expect(screen.queryByRole("link", { name: /Planos/ })).toBeNull();
  });

  it("publicar vaga nova ainda conta como a aba de vagas", () => {
    estado.caminho = "/empresa/vagas/nova";
    render(<AbasDaContratacao area={AREA_EMPRESA} />);

    expect(screen.getByRole("link", { name: "Vagas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
