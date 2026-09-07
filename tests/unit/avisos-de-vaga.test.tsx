/**
 * A tela dos avisos de vaga (#48).
 *
 * O que estes testes protegem é a ordem do pedido de permissão. **O
 * navegador só pergunta uma vez**: negada, não há como perguntar de novo,
 * nem depois de a pessoa mudar de ideia. Por isso o pedido vem depois de
 * ela escolher cidade e área e apertar o botão — pedir ao abrir a tela
 * queimaria a única chance com quem ainda não entendeu a oferta.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvisosDeVaga } from "@/components/avisos-de-vaga";

const acoes = {
  salvar: async () => ({ ok: true }),
  desligar: async () => ({ ok: true }),
  inscrever: async () => ({ ok: true }),
};

function montar(props: Partial<Parameters<typeof AvisosDeVaga>[0]> = {}) {
  return render(
    <AvisosDeVaga
      preferencia={null}
      cidadePadrao="Sinop"
      pushDisponivel
      chavePublica="chave"
      {...acoes}
      {...props}
    />,
  );
}

describe("avisos de vaga", () => {
  /**
   * Sem chaves VAPID o recurso não existe. A tela diz isso em vez de
   * aceitar a escolha e engolir — aceitar em silêncio faria a pessoa achar
   * que ligou. É a mesma regra do envio de arquivo sem Supabase.
   */
  it("sem push configurado, avisa em vez de oferecer", () => {
    montar({ pushDisponivel: false });

    expect(screen.getByText(/ainda não está no ar/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ligar avisos/i })).toBeNull();
  });

  it("oferece cidade e área, com a cidade da conta já escolhida", () => {
    montar();

    expect(screen.getByLabelText(/cidade/i)).toHaveValue("Sinop");
    expect(screen.getByLabelText(/área/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /ligar avisos/i })).toBeTruthy();
  });

  /** Quem já ligou vê o que escolheu, e o caminho para desligar. */
  it("com preferência salva, mostra o estado e o botão de desligar", () => {
    montar({ preferencia: { cidade: "Sorriso", categoria: "Agronegócio" } });

    expect(screen.getByLabelText(/cidade/i)).toHaveValue("Sorriso");
    expect(screen.getByLabelText(/área/i)).toHaveValue("Agronegócio");
    expect(
      screen.getByRole("button", { name: /atualizar avisos/i }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /desligar/i })).toBeTruthy();
  });

  it("sem preferência, não oferece desligar o que não está ligado", () => {
    montar();
    expect(screen.queryByRole("button", { name: /desligar/i })).toBeNull();
  });

  /**
   * jsdom não tem `serviceWorker`, que é exatamente o caso do iPhone antes
   * de a pessoa instalar o app na tela de início — o cenário real mais
   * comum de "não recebe aviso".
   */
  it("navegador sem suporte diz o que fazer, e não quebra", async () => {
    montar();

    await userEvent.click(
      screen.getByRole("button", { name: /ligar avisos/i }),
    );

    // `findByText` porque o estado muda depois do clique, e a asserção
    // síncrona corre contra a re-renderização.
    expect(await screen.findByText(/não recebe avisos/i)).toBeTruthy();
    expect(screen.getByText(/tela de início/i)).toBeTruthy();
  });

  /** Desligar é um clique, e "facilmente" é critério de aceite da Issue. */
  it("desligar chama a ação e volta ao estado inicial", async () => {
    const desligar = vi.fn(async () => ({ ok: true }));
    montar({
      preferencia: { cidade: "Sinop", categoria: null },
      desligar,
    });

    await userEvent.click(screen.getByRole("button", { name: /desligar/i }));

    expect(desligar).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("button", { name: /ligar avisos/i }),
    ).toBeTruthy();
  });
});
