/**
 * O bloco de pressão nos limites, renderizado (#217).
 *
 * Ele nasceu na #207 com teste de serviço, de repositório, da agregação
 * pura e da view num Postgres de verdade — e nenhum que o desenhasse. Isso
 * passou batido porque `ROTAS_NAO_VARRIDAS` afirmava que `/admin/painel`
 * tinha "cobertura própria em metricas-empresa.spec.ts", e aquele spec não
 * toca no admin: as três referências ao painel na suíte e2e conferem que
 * ele responde **404** para quem não é admin.
 *
 * É a armadilha que o AGENTS.md registra: *a lista de exclusões responde
 * por varredura, não por cobertura*. "Não é varrida por contraste" foi
 * lido como "está coberta em outro lugar".
 *
 * O que se testa aqui é o que quebra de verdade num bloco de painel: o
 * estado vazio, o plural, e o selo que só pode aparecer quando é verdade.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PressaoNosTetos } from "@/app/(app)/admin/painel/pressao-nos-tetos";
import type { PressaoNoTeto } from "@/server/metrics/tipos";

function linha(parcial: Partial<PressaoNoTeto> = {}): PressaoNoTeto {
  return {
    rotulo: "vaga.publicar",
    chaves: 2,
    chamadas: 11,
    bloqueadas: 0,
    pico: 7,
    ...parcial,
  };
}

describe("bloco de pressão nos limites", () => {
  /**
   * Vazio aqui é o estado bom, e a tela precisa dizer isso.
   *
   * "Nada encontrado" num painel costuma significar "ainda não mediu" — e
   * quem lê conclui que o bloco está quebrado e para de olhar. É o mesmo
   * cuidado que a fila do admin ganhou na #209.
   */
  it("sem linha nenhuma, explica que o vazio é o estado bom", () => {
    render(<PressaoNosTetos linhas={[]} />);
    expect(screen.getByText(/Ninguém encostando em teto nenhum/)).toBeVisible();
  });

  it("mostra a ação com volume, origens e pico", () => {
    render(<PressaoNosTetos linhas={[linha()]} />);

    expect(screen.getByText("vaga.publicar")).toBeVisible();
    expect(screen.getByText(/11 chamadas/)).toBeVisible();
    expect(screen.getByText(/2 origens/)).toBeVisible();
    expect(screen.getByText(/pico 7/)).toBeVisible();
  });

  it("o singular não sai errado", () => {
    render(
      <PressaoNosTetos linhas={[linha({ chamadas: 1, chaves: 1, pico: 1 })]} />,
    );

    expect(screen.getByText(/1 chamada ·/)).toBeVisible();
    expect(screen.getByText(/1 origem/)).toBeVisible();
  });

  /**
   * O selo de bloqueio é o único número com cor, porque é o único que muda
   * uma decisão. Desenhá-lo quando não há bloqueio nenhum ensinaria a
   * ignorá-lo — o mesmo defeito do "0%" de casamento que o AGENTS.md
   * registra.
   */
  it("sem bloqueio, nenhum selo é desenhado", () => {
    render(<PressaoNosTetos linhas={[linha({ bloqueadas: 0 })]} />);
    expect(screen.queryByText(/bloqueada/)).toBeNull();
  });

  it("com bloqueio, o selo e o aviso aparecem", () => {
    render(<PressaoNosTetos linhas={[linha({ bloqueadas: 1 })]} />);

    expect(screen.getByText("1 bloqueada")).toBeVisible();
    expect(screen.getByText(/1 chave bloqueada/)).toBeVisible();
    expect(screen.getByText(/abuso medido/)).toBeVisible();
  });

  it("o aviso soma os bloqueios de todas as ações", () => {
    render(
      <PressaoNosTetos
        linhas={[
          linha({ rotulo: "vaga.publicar", bloqueadas: 2 }),
          linha({ rotulo: "login", bloqueadas: 3 }),
        ]}
      />,
    );

    expect(screen.getByText(/5 chaves bloqueadas/)).toBeVisible();
  });

  /**
   * A promessa que a tela faz sobre si mesma, e que precisa continuar
   * verdadeira: isto é "agora", não histórico, e é por ação, não por
   * pessoa. As duas frases são o resumo da decisão da #207 — se alguém um
   * dia guardar histórico ou agrupar por usuário, é aqui que aparece.
   */
  it("diz que é agora e que não é por pessoa", () => {
    render(<PressaoNosTetos linhas={[]} />);

    const legenda = screen.getByText(/não é histórico/);
    expect(legenda).toBeVisible();
    expect(legenda.textContent).toMatch(/nunca por pessoa/);
  });
});
